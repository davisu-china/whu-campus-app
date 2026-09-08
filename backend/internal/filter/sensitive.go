// Package filter 敏感词过滤，基于 Aho-Corasick 多模式匹配。
// 构建后只读，可安全并发调用 Match。
package filter

import (
	"github.com/whu-campus/luojia-bbs/internal/model"
)

// 匹配级别
const (
	MatchNone   = 0 // 无命中
	MatchNormal = 1 // 命中一般词 → 送审
	MatchHigh   = 2 // 命中高危词 → 拒绝
)

type node struct {
	children map[rune]*node
	fail     *node
	level    int    // 该节点结尾词的最高等级
	word     string // 非空表示是某词的结尾
}

// Matcher AC 自动机。
type Matcher struct {
	root *node
}

// New 由敏感词列表构建自动机。
func New(words []model.SensitiveWord) *Matcher {
	m := &Matcher{root: &node{children: map[rune]*node{}}}
	for _, w := range words {
		if w.Status != model.StatusEnabled {
			continue
		}
		m.insert(w.Word, w.Level)
	}
	m.buildFail()
	return m
}

func (m *Matcher) insert(word string, level int) {
	cur := m.root
	for _, r := range word {
		if cur.children[r] == nil {
			cur.children[r] = &node{children: map[rune]*node{}}
		}
		cur = cur.children[r]
	}
	cur.word = word
	if cur.level < level {
		cur.level = level
	}
}

func (m *Matcher) buildFail() {
	queue := make([]*node, 0, 64)
	for _, child := range m.root.children {
		child.fail = m.root
		queue = append(queue, child)
	}
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		for r, child := range cur.children {
			queue = append(queue, child)
			fail := cur.fail
			for fail != nil && fail.children[r] == nil {
				fail = fail.fail
			}
			if fail == nil {
				child.fail = m.root
			} else {
				child.fail = fail.children[r]
			}
		}
	}
}

// Result 匹配结果。
type Result struct {
	Matched []string // 命中的敏感词
	Level   int      // MatchNone / MatchNormal / MatchHigh
}

// Match 对文本做多模式匹配，返回命中的词与最高级别。
func (m *Matcher) Match(text string) Result {
	res := Result{}
	cur := m.root
	for _, r := range text {
		for cur != m.root && cur.children[r] == nil {
			cur = cur.fail
		}
		if nxt, ok := cur.children[r]; ok {
			cur = nxt
		}
		for t := cur; t != m.root; t = t.fail {
			if t.word == "" {
				continue
			}
			res.Matched = append(res.Matched, t.word)
			if t.level == model.SensitiveLevelHigh {
				res.Level = MatchHigh
			} else if res.Level < MatchNormal {
				res.Level = MatchNormal
			}
		}
	}
	return res
}

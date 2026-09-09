package service

import (
	"context"
	"strings"
	"time"

	"github.com/whu-campus/luojia-bbs/internal/cache"
	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// InfoService 信息架构：分类/板块/标签/词典。
type InfoService struct {
	info  *repository.InfoRepo
	cache *cache.Client
}

func NewInfoService(info *repository.InfoRepo, c *cache.Client) *InfoService {
	return &InfoService{info: info, cache: c}
}

// CategoryTree 分类+板块树。
func (s *InfoService) CategoryTree() ([]CategoryWithBoards, error) {
	ctx := context.Background()
	key := cache.CategoryTreeKey()
	var result []CategoryWithBoards
	if hit, err := s.cache.GetJSON(ctx, key, &result); err == nil && hit {
		return result, nil
	}

	categories, err := s.info.ListCategories()
	if err != nil {
		return nil, xerr.New(xerr.CodeDBError, "查询分类失败").Wrap(err)
	}
	boards, err := s.info.ListBoards()
	if err != nil {
		return nil, xerr.New(xerr.CodeDBError, "查询板块失败").Wrap(err)
	}

	boardMap := make(map[string][]model.Board)
	for _, b := range boards {
		boardMap[b.CategoryID] = append(boardMap[b.CategoryID], b)
	}

	result = make([]CategoryWithBoards, 0, len(categories))
	for _, c := range categories {
		bs := boardMap[c.ID]
		if bs == nil {
			bs = []model.Board{}
		}
		result = append(result, CategoryWithBoards{Category: c, Boards: bs})
	}
	_ = s.cache.SetJSON(ctx, key, result, cache.InfoTTL)
	return result, nil
}

// BoardDetail 板块详情。
func (s *InfoService) BoardDetail(id string) (*model.Board, error) {
	ctx := context.Background()
	key := cache.BoardKey(id)
	var cached model.Board
	if hit, err := s.cache.GetJSON(ctx, key, &cached); err == nil && hit {
		return &cached, nil
	}

	b, err := s.info.GetBoard(id)
	if err != nil {
		return nil, xerr.New(xerr.CodeBoardNotFound, "板块不存在")
	}
	_ = s.cache.SetJSON(ctx, key, b, cache.InfoTTL)
	return b, nil
}

// BoardTags 板块标签。
func (s *InfoService) BoardTags(boardID string) ([]model.Tag, error) {
	ctx := context.Background()
	key := cache.BoardTagsKey(boardID)
	var cached []model.Tag
	if hit, err := s.cache.GetJSON(ctx, key, &cached); err == nil && hit {
		return cached, nil
	}

	tags, err := s.info.ListTags(boardID)
	if err != nil {
		return nil, err
	}
	_ = s.cache.SetJSON(ctx, key, tags, cache.InfoTTL)
	return tags, nil
}

// HotTags 板块热门标签（近 30 天发帖量降序，取前 N）。
func (s *InfoService) HotTags(boardID string, limit int) ([]repository.HotTag, error) {
	if limit <= 0 || limit > 20 {
		limit = 8
	}
	ctx := context.Background()
	key := cache.HotTagsKey(boardID, limit)
	var cached []repository.HotTag
	if hit, err := s.cache.GetJSON(ctx, key, &cached); err == nil && hit && cached != nil {
		return cached, nil
	}

	since := time.Now().AddDate(0, 0, -30)
	list, err := s.info.ListHotTags(boardID, since, limit)
	if err != nil {
		return nil, xerr.New(xerr.CodeDBError, "查询热门标签失败").Wrap(err)
	}
	if list == nil {
		list = []repository.HotTag{}
	}
	_ = s.cache.SetJSON(ctx, key, list, cache.HotTagsTTL)
	return list, nil
}

// SearchDict 词典搜索补全。
func (s *InfoService) SearchDict(dictType, q string, limit int) ([]model.DictItem, error) {
	switch dictType {
	case model.DictTypeCollege, model.DictTypeCourse, model.DictTypeTeacher, model.DictTypeContest:
	default:
		return nil, xerr.New(xerr.CodeBadParam, "未知词典类型")
	}
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	q = strings.TrimSpace(q)

	ctx := context.Background()
	key := cache.DictSearchKey(dictType, q, limit)
	var cached []model.DictItem
	if hit, err := s.cache.GetJSON(ctx, key, &cached); err == nil && hit {
		return cached, nil
	}

	items, err := s.info.SearchDict(dictType, q, limit)
	if err != nil {
		return nil, err
	}
	_ = s.cache.SetJSON(ctx, key, items, cache.InfoTTL)
	return items, nil
}

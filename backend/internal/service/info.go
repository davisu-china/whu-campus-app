package service

import (
	"strings"

	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// InfoService 信息架构：分类/板块/标签/词典。
type InfoService struct {
	info *repository.InfoRepo
}

func NewInfoService(info *repository.InfoRepo) *InfoService { return &InfoService{info: info} }

// CategoryTree 分类+板块树。
func (s *InfoService) CategoryTree() ([]CategoryWithBoards, error) {
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

	result := make([]CategoryWithBoards, 0, len(categories))
	for _, c := range categories {
		bs := boardMap[c.ID]
		if bs == nil {
			bs = []model.Board{}
		}
		result = append(result, CategoryWithBoards{Category: c, Boards: bs})
	}
	return result, nil
}

// BoardDetail 板块详情。
func (s *InfoService) BoardDetail(id string) (*model.Board, error) {
	b, err := s.info.GetBoard(id)
	if err != nil {
		return nil, xerr.New(xerr.CodeBoardNotFound, "板块不存在")
	}
	return b, nil
}

// BoardTags 板块标签。
func (s *InfoService) BoardTags(boardID string) ([]model.Tag, error) {
	return s.info.ListTags(boardID)
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
	return s.info.SearchDict(dictType, q, limit)
}

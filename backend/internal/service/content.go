package service

import (
	"context"
	"errors"
	"path/filepath"
	"sort"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/cache"
	"github.com/whu-campus/luojia-bbs/internal/config"
	"github.com/whu-campus/luojia-bbs/internal/filter"
	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/internal/storage"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// ContentService 内容：帖子、回复、搜索、上传。
type ContentService struct {
	content *repository.ContentRepo
	info    *repository.InfoRepo
	inter   *repository.InteractionRepo
	notif   *repository.NotificationRepo
	cache   *cache.Client
	storage *storage.Storage
	matcher *filter.Matcher
	cfg     *config.Config
}

func NewContentService(
	content *repository.ContentRepo,
	info *repository.InfoRepo,
	inter *repository.InteractionRepo,
	notif *repository.NotificationRepo,
	c *cache.Client,
	st *storage.Storage,
	matcher *filter.Matcher,
	cfg *config.Config,
) *ContentService {
	return &ContentService{
		content: content, info: info, inter: inter, notif: notif,
		cache: c, storage: st, matcher: matcher, cfg: cfg,
	}
}

// ---- 首页 ----

// listCacheEntry 内容列表缓存条目（列表 + 总数，供分页响应）。
type listCacheEntry struct {
	List  []PostView `json:"list"`
	Total int64      `json:"total"`
}

// getListCache 读取内容列表缓存；miss/出错返回 ok=false。
func (s *ContentService) getListCache(key string) (list []PostView, total int64, ok bool) {
	var e listCacheEntry
	if hit, err := s.cache.GetJSON(context.Background(), key, &e); err == nil && hit {
		return e.List, e.Total, true
	}
	return nil, 0, false
}

// setListCache 写入内容列表缓存（短 TTL，写操作后最多 15s 内可见）。
func (s *ContentService) setListCache(key string, list []PostView, total int64) {
	_ = s.cache.SetJSON(context.Background(), key, listCacheEntry{List: list, Total: total}, cache.ContentListTTL)
}

func (s *ContentService) HomeFeed(page, pageSize int) ([]PostView, int64, error) {
	// 首页信息流：全部已发布帖子，按发帖时间倒序（置顶优先）。
	// 仅缓存第一页（访问最密集的入口），短 TTL。
	if page == 1 {
		key := cache.HomeFeedKey(page, pageSize)
		if list, total, ok := s.getListCache(key); ok {
			return list, total, nil
		}
		posts, total, err := s.content.ListPosts(repository.PostListQuery{
			Sort:     "latest",
			Page:     page,
			PageSize: pageSize,
		})
		if err != nil {
			return nil, 0, xerr.New(xerr.CodeDBError, "查询信息流失败").Wrap(err)
		}
		views := mapPostsToViews(posts)
		s.setListCache(key, views, total)
		return views, total, nil
	}

	posts, total, err := s.content.ListPosts(repository.PostListQuery{
		Sort:     "latest",
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询信息流失败").Wrap(err)
	}
	return mapPostsToViews(posts), total, nil
}

func (s *ContentService) HomeHot(limit int) ([]PostView, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	key := cache.HomeHotKey(limit)
	if list, _, ok := s.getListCache(key); ok {
		return list, nil
	}
	posts, err := s.content.ListHot(limit)
	if err != nil {
		return nil, xerr.New(xerr.CodeDBError, "查询热门失败").Wrap(err)
	}
	views := mapPostsToViews(posts)
	s.setListCache(key, views, int64(len(views)))
	return views, nil
}

// ---- 板块帖子列表 ----

func (s *ContentService) BoardPosts(boardID, sort, tagID string, page, pageSize int) ([]PostView, int64, error) {
	// 仅缓存第一页、无标签筛选的列表（板块列表入口，短 TTL）。
	cacheable := page == 1 && tagID == ""
	if cacheable {
		key := cache.BoardPostsKey(boardID, sort, tagID, page, pageSize)
		if list, total, ok := s.getListCache(key); ok {
			return list, total, nil
		}
	}

	board, err := s.info.GetBoard(boardID)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeBoardNotFound, "板块不存在")
	}
	switch sort {
	case "", "comprehensive", "latest", "hot", "featured":
	default:
		return nil, 0, xerr.New(xerr.CodeBadParam, "未知排序方式")
	}
	posts, total, err := s.content.ListPosts(repository.PostListQuery{
		BoardID:  boardID,
		TagID:    tagID,
		Sort:     sort,
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询帖子失败").Wrap(err)
	}
	views := mapPostsToViews(posts)
	for i := range views {
		views[i].BoardName = board.Name
	}
	if cacheable {
		s.setListCache(cache.BoardPostsKey(boardID, sort, tagID, page, pageSize), views, total)
	}
	return views, total, nil
}

// ---- 帖子详情 ----

func (s *ContentService) PostDetail(id, currentUserID string) (*PostView, error) {
	post, err := s.content.GetPost(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, xerr.New(xerr.CodePostNotFound, "帖子不存在")
		}
		return nil, xerr.New(xerr.CodeDBError, "查询帖子失败").Wrap(err)
	}
	// 非作者仅可见已发布内容
	if post.Status != model.PostStatusPublished && post.AuthorID != currentUserID {
		return nil, xerr.New(xerr.CodePostNotVisible, "帖子不可见")
	}

	// 浏览计数：写入 Redis 计数器，由定时任务批量落库，避免每次浏览写 DB。
	_, _ = s.cache.HIncrBy(context.Background(), cache.ViewPendingKey(), post.ID, 1)
	post.ViewCount++

	view := s.buildPostViewDetail(post, currentUserID)
	return &view, nil
}

// ---- 发帖 ----

// FieldInput 结构化字段入参。
type FieldInput struct {
	FieldKey   string `json:"field_key"`
	DictItemID string `json:"dict_item_id"`
	RawValue   string `json:"raw_value"`
}

// CreatePostInput 发帖入参。
type CreatePostInput struct {
	BoardID     string       `json:"board_id"`
	Title       string       `json:"title"`
	Content     string       `json:"content"`
	IsAnonymous bool         `json:"is_anonymous"`
	TagIDs      []string     `json:"tag_ids"`   // 预置标签（按 ID）
	TagNames    []string     `json:"tag_names"` // 用户即时创建标签（按名称）
	Fields      []FieldInput `json:"fields"`
	ObjectKeys  []string     `json:"object_keys"`
}

// UpdatePostInput 编辑入参。
type UpdatePostInput struct {
	Title       string       `json:"title"`
	Content     string       `json:"content"`
	IsAnonymous bool         `json:"is_anonymous"`
	TagIDs      []string     `json:"tag_ids"`
	TagNames    []string     `json:"tag_names"`
	Fields      []FieldInput `json:"fields"`
	ObjectKeys  []string     `json:"object_keys"`
}

func (s *ContentService) CreatePost(author *model.User, in CreatePostInput) (*PostView, error) {
	if author.Status == model.UserStatusMuted || author.Status == model.UserStatusBanned {
		return nil, xerr.New(xerr.CodeUserBanned, "您已被禁言或封禁，暂不能发帖")
	}

	in.Title = strings.TrimSpace(in.Title)
	in.Content = strings.TrimSpace(in.Content)
	if in.Title == "" || in.Content == "" {
		return nil, xerr.New(xerr.CodeBadParam, "标题与正文不能为空")
	}
	if len([]rune(in.Title)) > 120 {
		return nil, xerr.New(xerr.CodeBadParam, "标题最长 120 字")
	}

	board, err := s.info.GetBoard(in.BoardID)
	if err != nil {
		return nil, xerr.New(xerr.CodeBoardNotFound, "板块不存在")
	}
	if board.Status != model.StatusEnabled {
		return nil, xerr.New(xerr.CodeBoardNotFound, "板块已停用")
	}

	// 树洞强制匿名
	if board.Slug == model.SlugTreeHole {
		in.IsAnonymous = true
	}

	// 敏感词过滤
	status := model.PostStatusPublished
	if s.matcher != nil {
		res := s.matcher.Match(in.Title + " " + in.Content)
		switch res.Level {
		case filter.MatchHigh:
			return nil, xerr.New(xerr.CodeSensitiveWord, "内容包含违规信息，无法发布")
		case filter.MatchNormal:
			status = model.PostStatusPending
		}
	}

	// 标签/结构化字段校验（标签制板块会在此即时创建用户标签）
	fields, tagIDs, err := s.validateFields(board, in, author.ID)
	if err != nil {
		return nil, err
	}

	post := &model.Post{
		BoardID:     board.ID,
		AuthorID:    author.ID,
		Title:       in.Title,
		Content:     in.Content,
		Status:      status,
		IsAnonymous: in.IsAnonymous,
	}

	atts := buildAttachments(in.ObjectKeys)

	if err := s.content.CreatePostWithDetails(post, tagIDs, fields, atts); err != nil {
		return nil, xerr.New(xerr.CodeDBError, "发帖失败").Wrap(err)
	}

	// 重新查询以装载关联
	created, err := s.content.GetPost(post.ID)
	if err != nil {
		return nil, xerr.New(xerr.CodeDBError, "查询帖子失败").Wrap(err)
	}
	view := s.buildPostViewDetail(created, author.ID)
	return &view, nil
}

// validateFields 依板块 field_mode 解析标签/结构化字段，返回结构化字段与最终标签 ID 列表。
func (s *ContentService) validateFields(board *model.Board, in CreatePostInput, userID string) ([]model.PostField, []string, error) {
	if board.FieldMode == model.FieldModeTags {
		tagIDs, err := s.resolveAndValidateTags(board, in.TagIDs, in.TagNames, userID)
		if err != nil {
			return nil, nil, err
		}
		return nil, tagIDs, nil
	}

	// 结构化字段板块
	fields := make([]model.PostField, 0, len(in.Fields))
	seen := map[string]bool{}
	for _, f := range in.Fields {
		if seen[f.FieldKey] {
			continue
		}
		seen[f.FieldKey] = true
		fields = append(fields, model.PostField{
			FieldKey:   f.FieldKey,
			DictItemID: f.DictItemID,
			RawValue:   f.RawValue,
		})
	}
	// 结构化字段板块（课程评价/竞赛组队）：不再强制要求填写课程名/老师/竞赛名（放开限制，字段可选）。
	return fields, nil, nil
}

const (
	maxTagsPerPost = 5
	maxTagNameLen  = 16
)

// resolveAndValidateTags 合并预置标签（tagIDs）与用户即时创建标签（tagNames），
// 校验标签归属与必选约束，返回去重后的标签 ID 列表。
func (s *ContentService) resolveAndValidateTags(board *model.Board, tagIDs, tagNames []string, userID string) ([]string, error) {
	userTagIDs, err := s.resolveTags(board.ID, tagNames, userID)
	if err != nil {
		return nil, err
	}
	combined := append(append([]string{}, tagIDs...), userTagIDs...)
	combined = dedupStrings(combined)
	if len(combined) > maxTagsPerPost {
		return nil, xerr.New(xerr.CodeTagTooMany, "标签最多 5 个")
	}

	tags, err := s.info.ListTags(board.ID)
	if err != nil {
		return nil, xerr.New(xerr.CodeDBError, "查询标签失败").Wrap(err)
	}
	valid := map[string]bool{}
	required := map[string]bool{}
	for i := range tags {
		valid[tags[i].ID] = true
		if tags[i].IsRequired {
			required[tags[i].ID] = true
		}
	}
	requiredCount := 0
	for _, tid := range combined {
		if !valid[tid] {
			return nil, xerr.New(xerr.CodeTagInvalid, "标签不属于该板块")
		}
		if required[tid] {
			requiredCount++
		}
	}
	if len(required) > 0 && requiredCount != 1 {
		return nil, xerr.New(xerr.CodeTagRequired, "请选择一个必选标签")
	}
	return combined, nil
}

// resolveTags 将用户提交的标签名解析为标签 ID：已存在则复用，否则即时创建（用户标签）。
func (s *ContentService) resolveTags(boardID string, tagNames []string, userID string) ([]string, error) {
	if len(tagNames) == 0 {
		return nil, nil
	}
	seen := map[string]bool{}
	ids := make([]string, 0, len(tagNames))
	for _, raw := range tagNames {
		name := strings.TrimSpace(raw)
		if name == "" {
			continue
		}
		if len([]rune(name)) > maxTagNameLen {
			return nil, xerr.New(xerr.CodeBadParam, "标签名最长 16 字")
		}
		// 标签名同样走敏感词过滤（高危拒绝）
		if s.matcher != nil {
			if res := s.matcher.Match(name); res.Level == filter.MatchHigh {
				return nil, xerr.New(xerr.CodeSensitiveWord, "标签包含违规信息")
			}
		}
		key := strings.ToLower(name)
		if seen[key] {
			continue
		}
		seen[key] = true

		tag, err := s.info.FindTagByName(boardID, name)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, xerr.New(xerr.CodeDBError, "查询标签失败").Wrap(err)
		}
		if tag == nil {
			tag = &model.Tag{
				BoardID:       boardID,
				Name:          name,
				IsUserCreated: true,
				CreatedBy:     &userID,
				Sort:          100, // 用户标签排在预置之后
				Status:        model.StatusEnabled,
			}
			if err := s.info.CreateTag(tag); err != nil {
				// 并发创建同名标签：唯一索引冲突则回退查询已存在标签
				existing, ferr := s.info.FindTagByName(boardID, name)
				if ferr == nil {
					tag = existing
				} else {
					return nil, xerr.New(xerr.CodeDBError, "创建标签失败").Wrap(err)
				}
			}
			// 即时创建后失效板块标签缓存，使新标签尽快可见
			_ = s.cache.Del(context.Background(), cache.BoardTagsKey(boardID))
			_ = s.cache.DelByPattern(context.Background(), "info:hot_tags:"+boardID+":*")
		}
		ids = append(ids, tag.ID)
	}
	return ids, nil
}

// dedupStrings 去除重复字符串并保持顺序。
func dedupStrings(in []string) []string {
	if len(in) == 0 {
		return nil
	}
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}

// ---- 编辑/删除 ----

func (s *ContentService) UpdatePost(author *model.User, id string, in UpdatePostInput) (*PostView, error) {
	post, err := s.content.GetPost(id)
	if err != nil {
		return nil, xerr.New(xerr.CodePostNotFound, "帖子不存在")
	}
	if post.AuthorID != author.ID {
		return nil, xerr.New(xerr.CodeNotAuthor, "仅作者可编辑")
	}
	fields := map[string]interface{}{}
	if in.Title != "" {
		fields["title"] = strings.TrimSpace(in.Title)
	}
	if in.Content != "" {
		fields["content"] = strings.TrimSpace(in.Content)
	}
	fields["is_anonymous"] = in.IsAnonymous
	if post.Board != nil && post.Board.Slug == model.SlugTreeHole {
		fields["is_anonymous"] = true
	}
	// 重新走敏感词过滤：命中高危拒绝，一般转待审核
	if in.Content != "" && s.matcher != nil {
		text := strings.TrimSpace(in.Title) + " " + strings.TrimSpace(in.Content)
		res := s.matcher.Match(text)
		switch res.Level {
		case filter.MatchHigh:
			return nil, xerr.New(xerr.CodeSensitiveWord, "内容包含违规信息，无法发布")
		case filter.MatchNormal:
			fields["status"] = model.PostStatusPending
		}
	}
	if len(fields) > 0 {
		if err := s.content.UpdatePost(id, fields); err != nil {
			return nil, xerr.New(xerr.CodeDBError, "编辑失败").Wrap(err)
		}
	}

	// 标签（仅 tag 型板块）：合并预置与即时创建标签后整体替换
	var tagIDs []string
	if (in.TagIDs != nil || in.TagNames != nil) && post.Board != nil && post.Board.FieldMode == model.FieldModeTags {
		ids, err := s.resolveAndValidateTags(post.Board, in.TagIDs, in.TagNames, author.ID)
		if err != nil {
			return nil, err
		}
		tagIDs = ids
	}

	// 附件（图片）：整体替换
	var atts []model.Attachment
	if in.ObjectKeys != nil {
		atts = buildAttachments(in.ObjectKeys)
	}

	if tagIDs != nil || atts != nil {
		if err := s.content.ReplacePostDetails(post.ID, tagIDs, atts); err != nil {
			return nil, xerr.New(xerr.CodeDBError, "编辑失败").Wrap(err)
		}
	}

	updated, _ := s.content.GetPost(id)
	view := s.buildPostViewDetail(updated, author.ID)
	return &view, nil
}

func (s *ContentService) DeletePost(author *model.User, id string) error {
	post, err := s.content.GetPost(id)
	if err != nil {
		return xerr.New(xerr.CodePostNotFound, "帖子不存在")
	}
	// 作者或运营可删
	if post.AuthorID != author.ID && author.Role < model.RoleOperator {
		return xerr.New(xerr.CodeNotAuthor, "无权删除")
	}
	if err := s.content.UpdatePost(id, map[string]interface{}{"status": model.PostStatusDeleted}); err != nil {
		return xerr.New(xerr.CodeDBError, "删除失败").Wrap(err)
	}
	return nil
}

// ---- 回复 ----

// CreateReplyInput 回复入参。
type CreateReplyInput struct {
	Content     string `json:"content"`
	IsAnonymous bool   `json:"is_anonymous"`
	ParentID    string `json:"parent_id"`   // 楼中楼父回复 ID（空=新楼层）
	ReplyToID   string `json:"reply_to_id"` // 被 @ 回复 ID（可选，缺省=parent_id）
}

func (s *ContentService) ListReplies(postID, currentUserID string, page, pageSize int) ([]ReplyView, int64, error) {
	total, err := s.content.CountFloors(postID)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询回复数失败").Wrap(err)
	}
	floors, err := s.content.ListFloors(postID, page, pageSize)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询回复失败").Wrap(err)
	}
	if len(floors) == 0 {
		return []ReplyView{}, total, nil
	}
	floorNos := make([]int, 0, len(floors))
	for i := range floors {
		floorNos = append(floorNos, floors[i].FloorNo)
	}
	// 楼中楼懒加载：列表只返回顶层楼层 + 各楼层楼中楼数量，楼中楼在展开时按需拉取。
	subCounts, err := s.content.CountSubReplies(postID, floorNos)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询楼中楼数量失败").Wrap(err)
	}
	views := make([]ReplyView, 0, len(floors))
	for i := range floors {
		v := s.buildReplyView(&floors[i], currentUserID)
		v.SubCount = int(subCounts[floors[i].FloorNo])
		views = append(views, v)
	}
	return views, total, nil
}

// FloorSubReplies 懒加载某楼层（floor_no）下的全部楼中楼（第二层 + 第三层树）。
func (s *ContentService) FloorSubReplies(postID string, floorNo int, currentUserID string) ([]ReplyView, error) {
	subs, err := s.content.ListSubReplies(postID, []int{floorNo})
	if err != nil {
		return nil, xerr.New(xerr.CodeDBError, "查询楼中楼失败").Wrap(err)
	}
	if len(subs) == 0 {
		return []ReplyView{}, nil
	}
	return s.assembleSubReplies(subs, currentUserID), nil
}

func (s *ContentService) CreateReply(author *model.User, postID string, in CreateReplyInput) (*ReplyView, error) {
	if author.Status == model.UserStatusMuted || author.Status == model.UserStatusBanned {
		return nil, xerr.New(xerr.CodeUserBanned, "您已被禁言或封禁，暂不能回复")
	}
	in.Content = strings.TrimSpace(in.Content)
	if in.Content == "" {
		return nil, xerr.New(xerr.CodeBadParam, "回复内容不能为空")
	}

	post, err := s.content.GetPost(postID)
	if err != nil {
		return nil, xerr.New(xerr.CodePostNotFound, "帖子不存在")
	}
	if post.Status != model.PostStatusPublished {
		return nil, xerr.New(xerr.CodePostNotVisible, "帖子不可回复")
	}
	if post.Board != nil && post.Board.Slug == model.SlugTreeHole {
		in.IsAnonymous = true
	}

	reply := &model.Reply{
		PostID:      postID,
		AuthorID:    author.ID,
		Content:     in.Content,
		IsAnonymous: in.IsAnonymous,
	}

	var parentAuthorID string
	if in.ParentID != "" {
		parent, err := s.content.GetReply(in.ParentID)
		if err != nil {
			return nil, xerr.New(xerr.CodeReplyNotFound, "回复对象不存在")
		}
		// 三层封顶：第三层（楼中楼的回复）不再开放回复入口，拒绝更深层。
		if parent.ParentID != nil {
			if gp, err := s.content.GetReply(*parent.ParentID); err == nil && gp.ParentID != nil {
				return nil, xerr.New(xerr.CodeBadParam, "最多支持三层回复")
			}
		}
		reply.ParentID = &parent.ID
		reply.FloorNo = parent.FloorNo
	}

	// 被 @ 对象：优先显式 reply_to_id，否则回退为父回复
	replyToID := in.ReplyToID
	if replyToID == "" {
		replyToID = in.ParentID
	}
	if replyToID != "" {
		target, err := s.content.GetReply(replyToID)
		if err != nil {
			return nil, xerr.New(xerr.CodeReplyNotFound, "回复对象不存在")
		}
		if target.PostID != postID {
			return nil, xerr.New(xerr.CodeBadParam, "回复对象不属于当前帖子")
		}
		reply.ReplyToID = &target.ID
		parentAuthorID = target.AuthorID
	}

	if _, err := s.content.CreateReplyWithFloor(postID, reply); err != nil {
		return nil, xerr.New(xerr.CodeDBError, "回复失败").Wrap(err)
	}

	s.notifyReply(post, parentAuthorID, author)

	created, _ := s.content.GetReply(reply.ID)
	view := s.buildReplyView(created, author.ID)
	return &view, nil
}

// notifyReply 生成回复相关通知。
func (s *ContentService) notifyReply(post *model.Post, parentAuthorID string, author *model.User) {
	// 通知楼主
	if post.AuthorID != author.ID {
		_ = s.notif.Create(&model.Notification{
			UserID:    post.AuthorID,
			Type:      model.NotifyTypeReply,
			Title:     "收到新回复",
			Content:   author.Nickname + " 回复了你的帖子《" + post.Title + "》",
			RelatedID: post.ID,
		})
	}
	// 通知被回复楼层作者
	if parentAuthorID != "" && parentAuthorID != author.ID && parentAuthorID != post.AuthorID {
		_ = s.notif.Create(&model.Notification{
			UserID:    parentAuthorID,
			Type:      model.NotifyTypeMention,
			Title:     "收到楼层回复",
			Content:   author.Nickname + " 回复了你的楼层",
			RelatedID: post.ID,
		})
	}
}

// ---- 搜索 ----

func (s *ContentService) Search(keyword, boardID, tagID string, page, pageSize int) ([]PostView, int64, error) {
	keyword = strings.TrimSpace(keyword)
	if keyword == "" {
		return nil, 0, xerr.New(xerr.CodeBadParam, "搜索关键词不能为空")
	}
	posts, total, err := s.content.SearchPosts(keyword, boardID, tagID, page, pageSize)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "搜索失败").Wrap(err)
	}
	return mapPostsToViews(posts), total, nil
}

// ---- 上传 ----

var imageExts = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
}

// PresignUploadResult 预签名结果（双协议）。
type PresignUploadResult struct {
	Protocol  string            `json:"protocol"`             // put | post
	UploadURL string            `json:"upload_url,omitempty"` // web：PUT URL
	URL       string            `json:"url,omitempty"`        // 小程序：POST 表单 URL
	Fields    map[string]string `json:"fields,omitempty"`     // 小程序：POST 表单字段
	ObjectKey string            `json:"object_key"`
	PublicURL string            `json:"public_url"` // 上传后的公开访问 URL
	ExpiresIn int64             `json:"expires_in"`
}

func (s *ContentService) PresignUpload(ctx context.Context, userID, filename, client, purpose string) (*PresignUploadResult, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	if !imageExts[ext] {
		return nil, xerr.New(xerr.CodeBadParam, "仅支持图片（jpg/png/webp/gif）")
	}
	objectKey := userID + "/" + uuid.NewString() + ext
	ttl := s.cfg.PresignTTLDuration()
	bucket := s.storage.PublicImagesBucket()
	if purpose == "avatar" {
		bucket = s.storage.PublicAvatarsBucket()
	}
	publicURL := s.storage.PublicURLForBucket(bucket, objectKey)

	// 微信小程序：Taro.uploadFile 仅支持 POST，走 PostPolicy 表单直传
	if client == "miniapp" {
		url, fields, err := s.storage.PresignPost(ctx, bucket, objectKey, ttl)
		if err != nil {
			return nil, xerr.New(xerr.CodeStorageErr, "生成上传链接失败").Wrap(err)
		}
		return &PresignUploadResult{Protocol: "post", URL: url, Fields: fields, ObjectKey: objectKey, PublicURL: publicURL, ExpiresIn: int64(ttl.Seconds())}, nil
	}

	// Web：PUT 直传
	url, err := s.storage.PresignPut(ctx, bucket, objectKey, ttl)
	if err != nil {
		return nil, xerr.New(xerr.CodeStorageErr, "生成上传链接失败").Wrap(err)
	}
	return &PresignUploadResult{Protocol: "put", UploadURL: url, ObjectKey: objectKey, PublicURL: publicURL, ExpiresIn: int64(ttl.Seconds())}, nil
}

// ---- 个人中心 ----

func (s *ContentService) MyPosts(userID string, page, pageSize int) ([]PostView, int64, error) {
	posts, total, err := s.content.ListMyPosts(userID, page, pageSize)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询失败").Wrap(err)
	}
	return mapPostsToViews(posts), total, nil
}

func (s *ContentService) MyReplies(userID string, page, pageSize int) ([]model.Reply, int64, error) {
	replies, total, err := s.content.ListMyReplies(userID, page, pageSize)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询失败").Wrap(err)
	}
	return replies, total, nil
}

func (s *ContentService) MyFavorites(userID string, page, pageSize int) ([]PostView, int64, error) {
	posts, total, err := s.inter.ListFavorites(userID, page, pageSize)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询收藏失败").Wrap(err)
	}
	return mapPostsToViews(posts), total, nil
}

// ---- 视图构建 ----

func mapPostsToViews(posts []model.Post) []PostView {
	views := make([]PostView, 0, len(posts))
	for i := range posts {
		views = append(views, buildPostViewList(&posts[i]))
	}
	return views
}

func buildPostViewList(p *model.Post) PostView {
	v := PostView{
		ID:          p.ID,
		BoardID:     p.BoardID,
		Title:       p.Title,
		Content:     p.Content,
		Status:      p.Status,
		IsAnonymous: p.IsAnonymous,
		IsPinned:    p.IsPinned,
		IsFeatured:  p.IsFeatured,
		ViewCount:   p.ViewCount,
		ReplyCount:  p.ReplyCount,
		LikeCount:   p.LikeCount,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
		Tags:        p.Tags,
	}
	if p.Board != nil {
		v.BoardName = p.Board.Name
	}
	v.AuthorID, v.Author = authorView(p.IsAnonymous, p.Author)
	return v
}

func (s *ContentService) buildPostViewDetail(p *model.Post, currentUserID string) PostView {
	v := buildPostViewList(p)
	v.IsMine = currentUserID != "" && p.AuthorID == currentUserID

	// 结构化字段与图片
	if len(p.Fields) == 0 {
		fields, err := s.content.ListPostFields(p.ID)
		if err == nil {
			v.Fields = fields
		}
	} else {
		v.Fields = p.Fields
	}
	atts, err := s.content.ListAttachments(model.OwnerTypePost, p.ID)
	if err == nil {
		v.Images = make([]ImageRef, 0, len(atts))
		for _, a := range atts {
			v.Images = append(v.Images, ImageRef{ObjectKey: a.ObjectKey, URL: s.storage.PublicURL(a.ObjectKey)})
		}
	}

	// 互动状态
	if currentUserID != "" {
		liked, err := s.inter.HasLike(currentUserID, model.TargetTypePost, p.ID)
		if err == nil {
			v.Liked = liked
		}
		fav, err := s.inter.HasFavorite(currentUserID, p.ID)
		if err == nil {
			v.Favorited = fav
		}
	}
	return v
}

// strOrEmpty 将可空字符串指针安全解引用为空串。
func strOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (s *ContentService) buildReplyView(r *model.Reply, currentUserID string) ReplyView {
	v := ReplyView{
		ID:          r.ID,
		PostID:      r.PostID,
		ParentID:    strOrEmpty(r.ParentID),
		ReplyToID:   strOrEmpty(r.ReplyToID),
		FloorNo:     r.FloorNo,
		Content:     r.Content,
		IsAnonymous: r.IsAnonymous,
		LikeCount:   r.LikeCount,
		CreatedAt:   r.CreatedAt,
	}
	v.AuthorID, v.Author = authorView(r.IsAnonymous, r.Author)
	if currentUserID != "" {
		liked, err := s.inter.HasLike(currentUserID, model.TargetTypeReply, r.ID)
		if err == nil {
			v.Liked = liked
		}
	}
	return v
}

// assembleSubReplies 组装某楼层下的楼中楼树（第二层 + 第三层）。
//
// 传入的是该楼层下的全部楼中楼（parent_id 均非空）。其中 parent_id 指向楼层本身
// （不在本集合内）的为第二层根，parent_id 指向其他楼中楼的为第三层。
// 用 childIDs 记录「展示父节点 → 子节点」的指针关系，最后自顶向下递归物化，
// 避免先把子节点值拷贝进父节点、再给子节点追加孙节点导致的孙节点丢失问题。
func (s *ContentService) assembleSubReplies(replies []model.Reply, currentUserID string) []ReplyView {
	byID := make(map[string]*ReplyView, len(replies))
	childIDs := make(map[string][]string, len(replies))

	var rootIDs []string
	for i := range replies {
		rv := s.buildReplyView(&replies[i], currentUserID)
		byID[rv.ID] = &rv
	}

	for id, rv := range byID {
		parent, ok := byID[rv.ParentID]
		if !ok {
			// 父节点（楼层）不在楼中楼集合内，视为第二层根。
			rootIDs = append(rootIDs, id)
			continue
		}
		childIDs[parent.ID] = append(childIDs[parent.ID], id)
	}

	// 自顶向下递归物化，楼中楼按时间正序。
	var build func(id string) ReplyView
	build = func(id string) ReplyView {
		node := *byID[id]
		ids := childIDs[id]
		if len(ids) > 0 {
			sort.SliceStable(ids, func(i, j int) bool {
				return byID[ids[i]].CreatedAt.Before(byID[ids[j]].CreatedAt)
			})
			node.Children = make([]ReplyView, 0, len(ids))
			for _, cid := range ids {
				node.Children = append(node.Children, build(cid))
			}
		}
		return node
	}

	sort.SliceStable(rootIDs, func(i, j int) bool {
		return byID[rootIDs[i]].CreatedAt.Before(byID[rootIDs[j]].CreatedAt)
	})

	result := make([]ReplyView, 0, len(rootIDs))
	for _, id := range rootIDs {
		result = append(result, build(id))
	}
	return result
}

func buildAttachments(keys []string) []model.Attachment {
	atts := make([]model.Attachment, 0, len(keys))
	for i, k := range keys {
		atts = append(atts, model.Attachment{
			OwnerType: model.OwnerTypePost,
			ObjectKey: k,
			Sort:      i,
		})
	}
	return atts
}

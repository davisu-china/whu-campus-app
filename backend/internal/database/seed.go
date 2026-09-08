package database

import (
	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/model"
)

type seedTag struct {
	name     string
	required bool
}

type seedBoard struct {
	slug      string
	name      string
	desc      string
	fieldMode int
	tags      []seedTag
}

type seedCategory struct {
	name   string
	boards []seedBoard
}

var seedCategories = []seedCategory{
	{
		name: "校园生活",
		boards: []seedBoard{
			{model.SlugSecondHand, "二手市场", "闲置交易（出/求/租）", model.FieldModeTags, []seedTag{
				{"出", true}, {"求", true}, {"租", true},
				{"教材", false}, {"数码", false}, {"生活用品", false}, {"衣物", false}, {"代步", false}, {"其他", false},
			}},
			{model.SlugLostFound, "失物招领", "寻物、寻主", model.FieldModeTags, []seedTag{
				{"寻物", true}, {"寻主", true},
				{"证件", false}, {"数码", false}, {"生活用品", false}, {"其他", false},
			}},
			{model.SlugCampusHelp, "校园互助", "跑腿、拼车、求助", model.FieldModeTags, []seedTag{
				{"拼车", false}, {"跑腿", false}, {"代取", false}, {"求助", false}, {"其他", false},
			}},
			{model.SlugCampusHot, "校园热点", "校内新闻、活动、讨论", model.FieldModeTags, []seedTag{
				{"资讯", false}, {"活动", false}, {"讨论", false}, {"其他", false},
			}},
		},
	},
	{
		name: "学习成长",
		boards: []seedBoard{
			{model.SlugCourseReview, "课程评价", "课程与教师评价", model.FieldModeStructured, nil},
			{model.SlugPostgraduate, "考研专区", "考研信息、经验、资料", model.FieldModeTags, []seedTag{
				{"数学", false}, {"英语", false}, {"政治", false}, {"专业课", false}, {"经验", false}, {"资料", false}, {"报录比", false}, {"其他", false},
			}},
			{model.SlugStudyAbroad, "保研出国", "保研、留学申请", model.FieldModeTags, []seedTag{
				{"保研", false}, {"留学", false}, {"夏令营", false}, {"经验", false}, {"其他", false},
			}},
			{model.SlugContestTeam, "竞赛组队", "学科竞赛组队", model.FieldModeStructured, nil},
			{model.SlugAcademic, "学术讨论", "科研、论文、学术交流", model.FieldModeTags, []seedTag{
				{"科研", false}, {"论文", false}, {"实验", false}, {"求助", false}, {"其他", false},
			}},
		},
	},
	{
		name: "职业发展",
		boards: []seedBoard{
			{model.SlugRecruit, "校招实习", "校招与实习招聘信息", model.FieldModeTags, []seedTag{
				{"校招", false}, {"实习", false}, {"宣讲会", false}, {"其他", false},
			}},
			{model.SlugReferral, "内推专区", "内推机会、求内推", model.FieldModeTags, []seedTag{
				{"内推", true}, {"求内推", true},
			}},
			{model.SlugJobExp, "求职经验", "面经、简历、笔试避坑", model.FieldModeTags, []seedTag{
				{"面经", false}, {"简历", false}, {"笔试", false}, {"避坑", false}, {"其他", false},
			}},
			{model.SlugGraduate, "毕业去向", "毕业去向与就业薪资", model.FieldModeTags, []seedTag{
				{"就业", false}, {"深造", false}, {"薪资", false}, {"经验", false}, {"其他", false},
			}},
		},
	},
	{
		name: "社交娱乐",
		boards: []seedBoard{
			{model.SlugDating, "校园恋爱", "交友、脱单", model.FieldModeTags, []seedTag{
				{"交友", false}, {"脱单", false}, {"情感", false},
			}},
			{model.SlugClub, "兴趣社团", "社团、同好、活动", model.FieldModeTags, []seedTag{
				{"招新", false}, {"活动", false}, {"组局", false}, {"其他", false},
			}},
			{model.SlugTreeHole, "树洞", "匿名倾诉", model.FieldModeTags, []seedTag{
				{"学业", false}, {"情感", false}, {"生活", false}, {"吐槽", false},
			}},
		},
	},
	{
		name: "站务",
		boards: []seedBoard{
			{model.SlugAnnouncement, "站务公告", "官方公告、规则、反馈", model.FieldModeTags, []seedTag{
				{"公告", false}, {"规则", false}, {"反馈", false}, {"招募", false},
			}},
		},
	},
}

// Seed 幂等写入基础数据（分类/板块/标签/词典/敏感词/运营账号）。
func Seed(db *gorm.DB) error {
	var boardCount int64
	if err := db.Model(&model.Board{}).Count(&boardCount).Error; err != nil {
		return err
	}
	if boardCount > 0 {
		return nil // 已初始化
	}

	return db.Transaction(func(tx *gorm.DB) error {
		for _, cat := range seedCategories {
			c := model.Category{Name: cat.name, Status: model.StatusEnabled}
			if err := tx.Create(&c).Error; err != nil {
				return err
			}
			for i, b := range cat.boards {
				board := model.Board{
					CategoryID:  c.ID,
					Name:        b.name,
					Slug:        b.slug,
					Description: b.desc,
					FieldMode:   b.fieldMode,
					Sort:        i,
					Status:      model.StatusEnabled,
				}
				if err := tx.Create(&board).Error; err != nil {
					return err
				}
				for j, t := range b.tags {
					tag := model.Tag{
						BoardID:    board.ID,
						Name:       t.name,
						IsRequired: t.required,
						Sort:       j,
						Status:     model.StatusEnabled,
					}
					if err := tx.Create(&tag).Error; err != nil {
						return err
					}
				}
			}
		}

		// 词典示例
		dicts := []model.DictItem{
			{DictType: model.DictTypeCollege, Name: "计算机学院"},
			{DictType: model.DictTypeCollege, Name: "经济与管理学院"},
			{DictType: model.DictTypeCollege, Name: "法学院"},
			{DictType: model.DictTypeCourse, Name: "数据结构"},
			{DictType: model.DictTypeCourse, Name: "操作系统"},
			{DictType: model.DictTypeCourse, Name: "高等数学"},
			{DictType: model.DictTypeTeacher, Name: "张三"},
			{DictType: model.DictTypeTeacher, Name: "李四"},
			{DictType: model.DictTypeContest, Name: "全国大学生数学建模竞赛"},
			{DictType: model.DictTypeContest, Name: "挑战杯"},
		}
		for i := range dicts {
			dicts[i].Status = model.StatusEnabled
			if err := tx.Create(&dicts[i]).Error; err != nil {
				return err
			}
		}

		// 敏感词示例（上线前按合规补齐）
		sensitive := []model.SensitiveWord{
			{Word: "代开发票", Category: "广告", Level: model.SensitiveLevelHigh},
			{Word: "兼职刷单", Category: "广告", Level: model.SensitiveLevelNormal},
		}
		for i := range sensitive {
			sensitive[i].Status = model.StatusEnabled
			if err := tx.Create(&sensitive[i]).Error; err != nil {
				return err
			}
		}

		// 运营账号（登录后即为运营，role=3）
		operator := model.User{
			Email:      "admin@whu.edu.cn",
			Nickname:   "珞珈小助手",
			IsVerified: true,
			Role:       model.RoleOperator,
			Status:     model.UserStatusNormal,
		}
		return tx.Create(&operator).Error
	})
}

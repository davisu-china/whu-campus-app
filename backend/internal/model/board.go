package model

// Category 分类（校园生活/学习成长/…）。
type Category struct {
	Base
	Name   string `gorm:"size:32" json:"name"`
	Sort   int    `gorm:"default:0" json:"sort"`
	Status int    `gorm:"type:smallint;default:0" json:"status"`
}

// Board 板块。
type Board struct {
	Base
	CategoryID  string `gorm:"type:uuid;index" json:"category_id"`
	Name        string `gorm:"size:32" json:"name"`
	Slug        string `gorm:"size:32;uniqueIndex" json:"slug"`
	Description string `gorm:"size:200" json:"description"`
	FieldMode   int    `gorm:"type:smallint;default:0" json:"field_mode"` // 0 预置标签 / 1 结构化字段
	Sort        int    `gorm:"default:0" json:"sort"`
	Status      int    `gorm:"type:smallint;default:0" json:"status"`
}

// Tag 板块级标签。
type Tag struct {
	Base
	BoardID    string `gorm:"type:uuid;index" json:"board_id"`
	Name       string `gorm:"size:32" json:"name"`
	IsRequired bool   `gorm:"default:false" json:"is_required"` // 强分类板块：必选+单选
	Sort       int    `gorm:"default:0" json:"sort"`
	Status     int    `gorm:"type:smallint;default:0" json:"status"`
}

// DictItem 词典条目（学院/课程/老师/竞赛），归一化标准名。
type DictItem struct {
	Base
	DictType string `gorm:"size:16;uniqueIndex:uniq_dict_type_name" json:"dict_type"`
	Name     string `gorm:"size:128;uniqueIndex:uniq_dict_type_name" json:"name"`
	Status   int    `gorm:"type:smallint;default:0" json:"status"`
}

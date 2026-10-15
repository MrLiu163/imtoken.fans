// 提交表单「标签」选择器用的固定分类，取代之前的自由文本输入，避免标签参差不齐。
// 每个标签的 id 就是英文原文（存进 submissions.tags 的值），zh/en 只是展示用的文案，
// 切换语言只影响展示，不影响已经存的数据。

export interface TagOption {
  id: string;
  zh: string;
  en: string;
}

export interface TagGroup {
  id: string;
  zh: string;
  en: string;
  tags: TagOption[];
}

export interface TagCategory {
  id: string;
  zh: string;
  en: string;
  groups: TagGroup[];
}

function tag(en: string, zh: string): TagOption {
  return { id: en, zh, en };
}

export const TAG_TAXONOMY: TagCategory[] = [
  {
    id: "dev-tech",
    zh: "开发、技术与基础架构",
    en: "Development & Tech",
    groups: [
      {
        id: "software-dev",
        zh: "软件开发",
        en: "Software Development",
        tags: [
          tag("API", "API"),
          tag("Android", "Android"),
          tag("iOS", "iOS"),
          tag("iPad", "iPad"),
          tag("Linux", "Linux"),
          tag("Mac", "Mac"),
          tag("Windows", "Windows"),
          tag("SDK", "SDK"),
          tag("Software Engineering", "软件工程"),
          tag("Developer Tools", "开发者工具"),
          tag("Development", "开发"),
          tag("Development Language", "开发语言"),
          tag("Open Source", "开源"),
          tag("GitHub", "GitHub"),
          tag("Version Control (Work In Progress)", "版本控制"),
          tag("Text Editors", "文本编辑器"),
        ],
      },
      {
        id: "web-tech",
        zh: "Web 技术",
        en: "Web Technology",
        tags: [
          tag("Web App", "Web 应用"),
          tag("Website Builder", "建站工具"),
          tag("WordPress", "WordPress"),
          tag("Web Design", "网页设计"),
          tag("Chrome Extensions", "Chrome 扩展"),
          tag("Browser Extensions", "浏览器扩展"),
          tag("Safari Extensions", "Safari 扩展"),
          tag("Edge Extensions", "Edge 扩展"),
          tag("iMessage Apps", "iMessage 应用"),
          tag("Menu Bar Apps", "菜单栏应用"),
          tag("Touch Bar Apps", "Touch Bar 应用"),
        ],
      },
      {
        id: "web3-ai",
        zh: "新兴技术（Web3 / AI）",
        en: "Emerging Tech (Web3/AI)",
        tags: [
          tag("Artificial Intelligence", "人工智能"),
          tag("OpenAI Day", "OpenAI Day"),
          tag("Vibe coding", "Vibe Coding"),
          tag("Blockchain", "区块链"),
          tag("Crypto", "加密"),
          tag("Cryptocurrency", "加密货币"),
          tag("Bitcoin", "比特币"),
          tag("Ethereum", "以太坊"),
          tag("DAO", "DAO"),
          tag("DApp", "DApp"),
          tag("Web3", "Web3"),
          tag("NFT", "NFT"),
        ],
      },
      {
        id: "data-cloud",
        zh: "数据与云",
        en: "Data & Cloud",
        tags: [
          tag("Data", "数据"),
          tag("Database", "数据库"),
          tag("Data Science", "数据科学"),
          tag("Data & Analytics", "数据与分析"),
          tag("Data Visualization", "数据可视化"),
          tag("Statistical Analysis", "统计分析"),
          tag("Storage", "存储"),
          tag("Sensors", "传感器"),
          tag("Hacking", "黑客技术"),
          tag("Security", "安全"),
          tag("Privacy", "隐私"),
          tag("VPN", "VPN"),
        ],
      },
      {
        id: "hardware",
        zh: "硬件",
        en: "Hardware",
        tags: [
          tag("Hardware", "硬件"),
          tag("Computers", "电脑"),
          tag("Custom Keyboards", "定制键盘"),
          tag("Drones", "无人机"),
          tag("Robots", "机器人"),
          tag("Wearables", "可穿戴设备"),
          tag("3D Printer", "3D 打印机"),
          tag("Batteries", "电池"),
        ],
      },
    ],
  },
  {
    id: "business-productivity",
    zh: "商业、财务与生产力",
    en: "Business & Productivity",
    groups: [
      {
        id: "business-mgmt",
        zh: "商业管理",
        en: "Business Management",
        tags: [
          tag("Business", "商业"),
          tag("Business Intelligence", "商业智能"),
          tag("CRM", "CRM"),
          tag("Change Management", "变革管理"),
          tag("Consulting", "咨询"),
          tag("Customer Communication", "客户沟通"),
          tag("Customer Success", "客户成功"),
          tag("Hiring", "招聘"),
          tag("Human Resources", "人力资源"),
          tag("Operations", "运营"),
          tag("Project Management", "项目管理"),
          tag("Public Relations", "公共关系"),
          tag("Sales", "销售"),
          tag("Startup Lessons", "创业经验"),
        ],
      },
      {
        id: "finance-investment",
        zh: "财务与投资",
        en: "Finance & Investment",
        tags: [
          tag("Finance", "金融"),
          tag("Fintech", "金融科技"),
          tag("Accounting", "会计"),
          tag("Banking", "银行"),
          tag("Budgeting", "预算管理"),
          tag("Credit card", "信用卡"),
          tag("DeFi", "DeFi"),
          tag("Fundraising", "融资"),
          tag("Investing", "投资"),
          tag("Money", "资金"),
          tag("Payments", "支付"),
          tag("Personal Finance", "个人理财"),
          tag("Venture Capital", "风险投资"),
        ],
      },
      {
        id: "productivity-tools",
        zh: "生产力工具",
        en: "Productivity Tools",
        tags: [
          tag("Productivity", "生产力"),
          tag("Calendar", "日历"),
          tag("Email", "邮件"),
          tag("Meetings", "会议"),
          tag("Messaging", "即时通讯"),
          tag("Notion", "Notion"),
          tag("Slack", "Slack"),
          tag("Spreadsheets", "表格"),
          tag("Task Management", "任务管理"),
          tag("Time Tracking", "时间跟踪"),
          tag("Remote Work", "远程办公"),
          tag("Side Project", "副业项目"),
        ],
      },
      {
        id: "marketing-sales",
        zh: "营销与销售",
        en: "Marketing & Sales",
        tags: [
          tag("Marketing", "营销"),
          tag("Advertising", "广告"),
          tag("Affiliate marketing", "联盟营销"),
          tag("E-Commerce", "电商"),
          tag("Email Marketing", "邮件营销"),
          tag("Event marketing", "活动营销"),
          tag("Growth Hacking", "增长黑客"),
          tag("SEO", "SEO"),
          tag("Social media marketing", "社媒营销"),
        ],
      },
    ],
  },
  {
    id: "creative-design",
    zh: "创意、设计与多媒体",
    en: "Creative & Design",
    groups: [
      {
        id: "design",
        zh: "设计",
        en: "Design",
        tags: [
          tag("Design", "设计"),
          tag("Design resources", "设计资源"),
          tag("Design templates", "设计模板"),
          tag("Design Tools", "设计工具"),
          tag("Graphic Design", "平面设计"),
          tag("Icons", "图标"),
          tag("Illustration", "插画"),
          tag("Logo Design", "Logo 设计"),
          tag("Prototyping", "原型设计"),
          tag("Sketch", "Sketch"),
          tag("Typography", "字体排印"),
          tag("User Experience (UX)", "用户体验"),
          tag("UX Design", "UX 设计"),
          tag("Wireframing", "线框图"),
          tag("3D Modeling", "3D 建模"),
        ],
      },
      {
        id: "multimedia",
        zh: "多媒体",
        en: "Multimedia",
        tags: [
          tag("Photography", "摄影"),
          tag("Photo editing", "修图"),
          tag("Photoshop", "Photoshop"),
          tag("Photo & Video", "图片与视频"),
          tag("Video", "视频"),
          tag("Video Art", "视频艺术"),
          tag("Video cameras", "摄像机"),
          tag("Video Streaming", "视频流"),
          tag("Animation", "动画"),
          tag("Digital Art", "数字艺术"),
          tag("Drawing", "绘画"),
          tag("Painting", "画作"),
          tag("GIFs", "GIF"),
          tag("Wallpaper", "壁纸"),
        ],
      },
      {
        id: "audio",
        zh: "音效",
        en: "Audio",
        tags: [
          tag("Audio", "音频"),
          tag("DJing", "打碟"),
          tag("Music", "音乐"),
          tag("Classical Music", "古典音乐"),
          tag("Electronic Music", "电子音乐"),
          tag("Hip-Hop", "嘻哈"),
          tag("Radio", "广播"),
          tag("Spotify", "Spotify"),
          tag("SoundCloud", "SoundCloud"),
        ],
      },
    ],
  },
  {
    id: "games-entertainment",
    zh: "游戏、娱乐与 XR",
    en: "Games & Entertainment",
    groups: [
      {
        id: "xr",
        zh: "XR 体验",
        en: "XR Experiences",
        tags: [
          tag("Augmented Reality", "增强现实"),
          tag("Virtual Reality", "虚拟现实"),
          tag("Mixed Reality", "混合现实"),
          tag("Extended Reality", "扩展现实"),
          tag("ARKit", "ARKit"),
          tag("Gear VR", "Gear VR"),
          tag("HTC Vive", "HTC Vive"),
          tag("Oculus Rift", "Oculus Rift"),
          tag("PlayStation VR", "PlayStation VR"),
        ],
      },
      {
        id: "game-genres",
        zh: "游戏分类",
        en: "Game Genres",
        tags: [
          tag("Action Games", "动作游戏"),
          tag("Adventure Games", "冒险游戏"),
          tag("Board Games", "桌游"),
          tag("Card Games", "卡牌游戏"),
          tag("Crafting Games", "建造游戏"),
          tag("Driving Games", "驾驶游戏"),
          tag("Fantasy Games", "奇幻游戏"),
          tag("Farming", "农场游戏"),
          tag("Fighting Games", "格斗游戏"),
          tag("Free Games", "免费游戏"),
          tag("Funny Games", "趣味游戏"),
          tag("Historical Games", "历史游戏"),
          tag("Horror Games", "恐怖游戏"),
          tag("Indie Games", "独立游戏"),
          tag("Isometric Games", "等距游戏"),
          tag("MMOs", "大型多人在线游戏"),
          tag("Open World Games", "开放世界游戏"),
          tag("Platformers", "平台跳跃游戏"),
          tag("Puzzle Games", "解谜游戏"),
          tag("Racing", "竞速游戏"),
          tag("Retro Games", "复古游戏"),
          tag("RPGs", "角色扮演游戏"),
          tag("Sci-Fi Games", "科幻游戏"),
          tag("Simulation Games", "模拟游戏"),
          tag("Sports Games", "体育游戏"),
          tag("Strategy Games", "策略游戏"),
          tag("Survival", "生存游戏"),
          tag("Tabletop Games", "桌面游戏"),
          tag("Tower Defense Games", "塔防游戏"),
          tag("Word Games", "文字游戏"),
          tag("Zombie Games", "僵尸游戏"),
        ],
      },
      {
        id: "entertainment-platforms",
        zh: "娱乐平台",
        en: "Entertainment Platforms",
        tags: [
          tag("Nintendo", "任天堂"),
          tag("PC", "PC"),
          tag("Playstation", "PlayStation"),
          tag("Star Wars", "星球大战"),
          tag("XBox", "XBox"),
          tag("Movies", "电影"),
          tag("TV", "电视剧"),
          tag("Streaming Services", "流媒体服务"),
          tag("Live Events", "现场活动"),
          tag("Concerts", "演唱会"),
        ],
      },
    ],
  },
  {
    id: "lifestyle-health",
    zh: "生活方式、健康与社交",
    en: "Lifestyle & Health",
    groups: [
      {
        id: "social-networks",
        zh: "社交网络",
        en: "Social Networks",
        tags: [
          tag("Social Media", "社交媒体"),
          tag("Social Network", "社交网络"),
          tag("Social Networking", "社交网络服务"),
          tag("Community", "社区"),
          tag("Facebook Messenger", "Facebook Messenger"),
          tag("Instagram", "Instagram"),
          tag("LinkedIn", "LinkedIn"),
          tag("Reddit", "Reddit"),
          tag("Snapchat", "Snapchat"),
          tag("Telegram", "Telegram"),
          tag("Twitter", "Twitter"),
          tag("YouTube", "YouTube"),
        ],
      },
      {
        id: "health-fitness",
        zh: "健康与健身",
        en: "Health & Fitness",
        tags: [
          tag("Health", "健康"),
          tag("Health & Fitness", "健康与健身"),
          tag("Biohacking", "生物黑客"),
          tag("Biking", "骑行"),
          tag("Fitness", "健身"),
          tag("Meditation", "冥想"),
          tag("Nutrition", "营养"),
          tag("Psychedelics", "致幻剂"),
          tag("Running", "跑步"),
          tag("Sports", "运动"),
          tag("Surfing", "冲浪"),
          tag("Swimming", "游泳"),
          tag("Tennis", "网球"),
          tag("Weightlifting", "举重"),
          tag("Yoga", "瑜伽"),
        ],
      },
      {
        id: "home-living",
        zh: "居家与生活",
        en: "Home & Living",
        tags: [
          tag("Home Automation", "智能家居"),
          tag("Home office", "家庭办公"),
          tag("Home security", "家庭安防"),
          tag("Home services", "家政服务"),
          tag("Home theater", "家庭影院"),
          tag("Interior design", "室内设计"),
          tag("Furniture", "家具"),
          tag("Appliances", "家电"),
          tag("Pets", "宠物"),
          tag("Dogs", "狗"),
          tag("Cats", "猫"),
          tag("Parenting", "育儿"),
          tag("Babies", "婴儿"),
          tag("Kids", "儿童"),
          tag("DIY", "DIY"),
          tag("Gardening (Plants)", "园艺"),
        ],
      },
      {
        id: "consumer-services",
        zh: "消费与服务",
        en: "Consumer & Services",
        tags: [
          tag("Shopping", "购物"),
          tag("Fashion", "时尚"),
          tag("Accessories", "配饰"),
          tag("Clothing", "服装"),
          tag("Sneakers & Shoes", "鞋履"),
          tag("Jewelry", "珠宝"),
          tag("Cosmetics", "美妆"),
          tag("Beauty", "美容"),
          tag("Food Delivery", "外卖"),
          tag("Food & Drink", "餐饮"),
          tag("Wine", "葡萄酒"),
          tag("Coffee", "咖啡"),
          tag("Dining", "餐厅"),
          tag("Hotels", "酒店"),
          tag("Travel", "旅行"),
          tag("Vacation", "度假"),
        ],
      },
    ],
  },
  {
    id: "education-science",
    zh: "教育、科学与社会",
    en: "Education & Science",
    groups: [
      {
        id: "academics-education",
        zh: "学术与教育",
        en: "Academics & Education",
        tags: [
          tag("Education", "教育"),
          tag("Online Learning", "在线学习"),
          tag("School", "学校"),
          tag("Languages", "语言学习"),
          tag("Science", "科学"),
          tag("Physics", "物理"),
          tag("Space", "太空"),
          tag("Climate Tech", "气候科技"),
          tag("History", "历史"),
          tag("Politics", "政治"),
          tag("Political news", "政治新闻"),
        ],
      },
      {
        id: "books-reading",
        zh: "书籍与阅读",
        en: "Books & Reading",
        tags: [
          tag("Books", "书籍"),
          tag("Art Books", "艺术类书籍"),
          tag("Business Books", "商业类书籍"),
          tag("Coding Books", "编程类书籍"),
          tag("Cookbooks", "烹饪书"),
          tag("History Books", "历史类书籍"),
          tag("Horror Books", "恐怖小说"),
          tag("Novels", "小说"),
          tag("Startup Books", "创业类书籍"),
          tag("Textbooks", "教材"),
          tag("Thriller Books", "惊悚小说"),
          tag("Adult Coloring Books", "成人涂色书"),
          tag("Comics & Graphic Novels", "漫画"),
          tag("Newsletters", "邮件订阅刊物"),
        ],
      },
    ],
  },
];

export const ALL_TAGS: TagOption[] = TAG_TAXONOMY.flatMap((category) =>
  category.groups.flatMap((group) => group.tags)
);

const TAG_BY_ID = new Map(ALL_TAGS.map((t) => [t.id, t]));

export const MAX_TAGS = 10;

// 只保留固定分类里存在的 id、去重、限量——防止客户端绕过 UI 直接传自由文本进来。
export function normalizeTags(input: string[]): string[] {
  return [...new Set(input.filter((id) => TAG_BY_ID.has(id)))].slice(0, MAX_TAGS);
}

export function getTagLabel(id: string, locale: string): string {
  const option = TAG_BY_ID.get(id);
  if (!option) return id;
  return locale === "zh" ? option.zh : option.en;
}

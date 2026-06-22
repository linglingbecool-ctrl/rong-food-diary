# 蓉食记

蓉食记是一个纯前端的成都探店记录应用。应用使用 React、Vite、TypeScript 和 IndexedDB，可以记录餐厅、探店、菜品、图片、想吃清单、统计图表和地图位置。

## 功能

- 首页数据概览和最近探店
- 餐厅列表、探店记录列表
- 关键词搜索、行政区筛选、餐饮类型筛选、价格区间筛选、评分筛选、标签筛选
- 探店时间、评分、人均消费排序
- 想吃清单新增、编辑、删除、随机选店、转为探店记录
- 新增、编辑、删除探店记录
- JPG、PNG、WebP 图片上传、浏览器端压缩、缩略图、详情大图
- IndexedDB 本地持久化存储
- JSON 数据导出和导入
- 导入前自动备份、覆盖导入、合并导入、重复数据检测
- 清空全部数据、二次确认、恢复示例数据
- 数据统计页、月度趋势、餐饮类型分布、行政区分布、复访意愿分布
- 高德地图 JavaScript API，支持地图失败列表兜底
- GitHub Pages 静态部署

## 本地启动

```bash
npm install
npm run dev
```

默认本地开发地址通常是：

```text
http://127.0.0.1:5173/
```

## 构建检查

```bash
npm run typecheck
npm run build
```

构建产物输出到 `dist/`。

## 环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

仓库名为 `rong-food-diary` 时保持：

```bash
VITE_BASE_PATH=/rong-food-diary/
```

高德地图配置：

```bash
VITE_AMAP_KEY=你的高德Web端JSAPIKey
VITE_AMAP_SECURITY_CODE=你的安全密钥
```

说明：

- `VITE_AMAP_KEY` 为空时，地图页会显示配置提示，并自动显示餐厅列表兜底。
- `VITE_AMAP_SECURITY_CODE` 只建议开发调试使用。生产环境更建议通过代理服务保存安全密钥。
- `.env.local` 不要提交到 GitHub。
- Vite 的 `VITE_*` 变量会在构建时写入前端产物，高德 Web 端 Key 在部署后的 JS 文件里可见。

## 高德地图 Key 申请

1. 打开 [高德开放平台控制台](https://console.amap.com/)。
2. 注册或登录账号。
3. 进入 `应用管理`。
4. 创建应用。
5. 添加 Key，服务平台选择 `Web端(JS API)`。
6. 复制 Key 到 `.env.local` 的 `VITE_AMAP_KEY`。
7. 如果控制台要求安全密钥，复制到 `VITE_AMAP_SECURITY_CODE`。

## GitHub Pages 自动部署

项目已包含：

```text
.github/workflows/pages.yml
.nojekyll
public/404.html
```

部署方式使用 GitHub Actions。每次 push 到 `main` 分支会自动执行：

```bash
npm ci
npm run build
```

然后把 `dist/` 发布到 GitHub Pages。

## 从 GitHub 创建仓库到上线

1. 打开 GitHub，点击右上角 `+`。
2. 点击 `New repository`。
3. Repository name 填写 `rong-food-diary`。
4. 选择 `Public` 或 `Private`。
5. 不要勾选自动创建 README、`.gitignore` 或 license。
6. 点击 `Create repository`。
7. 在本地进入项目目录：

```bash
cd /Users/lingling/Documents/测试/rong-food-diary
```

8. 如果当前目录还不是 git 仓库，执行：

```bash
git init
git branch -M main
```

9. 添加远程仓库：

```bash
git remote add origin https://github.com/你的GitHub用户名/rong-food-diary.git
```

10. 提交并推送：

```bash
git add .
git commit -m "Deploy rong food diary"
git push -u origin main
```

11. 在 GitHub 仓库页面点击 `Settings`。
12. 左侧点击 `Pages`。
13. 在 `Build and deployment` 下，`Source` 选择 `GitHub Actions`。
14. 左侧点击 `Secrets and variables`，进入 `Actions`。
15. 点击 `New repository secret`，添加 `VITE_AMAP_KEY`。
16. 如需安全密钥，再添加 `VITE_AMAP_SECURITY_CODE`。
17. 点击顶部 `Actions`。
18. 打开 `Deploy GitHub Pages` workflow，确认运行成功。
19. 回到 `Settings -> Pages` 查看站点地址。

GitHub Pages 地址格式：

```text
https://你的GitHub用户名.github.io/rong-food-diary/
```

内部页面使用 HashRouter。详情页刷新地址示例：

```text
https://你的GitHub用户名.github.io/rong-food-diary/#/restaurants/restaurant-id
https://你的GitHub用户名.github.io/rong-food-diary/#/visits/visit-id
```

## 后续更新网站

每次修改代码后执行：

```bash
npm run typecheck
npm run build
git add .
git commit -m "Update rong food diary"
git push
```

推送后 GitHub Actions 会自动重新部署。

## 数据备份注意事项

- 业务数据和图片 Blob 保存在当前浏览器的 IndexedDB 中，不在 GitHub 仓库里。
- 换浏览器、清理浏览器数据、无痕模式、系统清理工具都可能导致本地数据丢失。
- 上线前和大量修改数据前，进入 `我的 -> 设置和数据管理 -> 导出 JSON` 下载备份。
- JSON 导出文件包含图片数据，文件可能较大。
- 导入 JSON 前应用会自动下载当前数据备份。
- 合并导入会跳过重复 id；覆盖导入会替换当前 IndexedDB 数据。
- 不要把包含私人探店记录或图片的 JSON 备份提交到公开 GitHub 仓库。

## 已知限制

- 当前没有账号系统，数据只保存在当前浏览器本地。
- GitHub Pages 是静态托管，不提供服务端数据库。
- 高德地图 Key 需要在构建环境配置；未配置时地图会降级为列表。
- 高德 Web 端 Key 会出现在构建后的前端 JS 中，这是纯静态站点的限制。
- 不同设备之间不会自动同步数据，需要手动导出和导入 JSON。

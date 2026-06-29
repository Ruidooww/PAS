# M9 文档级与内容级权限矩阵

## 1. 文档定位

本文档是 M9 权限体系的业务输入，用于后续文档级 ACL、ABAC 属性级权限、项目组隔离、外部分享、导出和水印策略设计。本文档定义业务角色、资源类型、操作矩阵、属性维度、项目组边界和端到端 trace 场景，作为后续工程任务的输入依据。

本文档不做工程实现，不修改 API、数据库 schema、前端页面、后端 runtime、guard、provider integration、ACL 字段、ABAC engine、OPA policy evaluator、项目组隔离 runtime、外部分享、水印、权限 middleware、AgentRuntime、WorkflowEngine、PluginManager 或多租户平台能力。

## 2. 当前确认状态

| 角色 | 确认内容 | 状态 |
|---|---|---|
| 业务负责人 | 权限角色、业务使用场景、默认权限边界 | 待确认 |
| 安全合规负责人 | 敏感资源分级、跨组访问、导出 / 分享 / 删除边界 | 待确认 |
| 售前主管 | 日常工作权限粒度是否可操作、是否影响售前效率 | 待确认 |
| 管理员 / 运维负责人 | 管理端能力、审计、权限回收流程 | 可选确认 |

在上述角色确认前，本文档只能作为 M9 权限字段表和权限规则草案输入，不能解锁 M9 文档级 ACL、ABAC、OPA、项目组隔离、外部分享、水印或权限 runtime 工程实现。

## 3. 角色清单

| 角色 | 职责 | 默认范围 | 敏感操作边界 |
|---|---|---|---|
| 售前 | 负责客户需求调研、方案编写、知识库查询和售前材料准备 | 本人参与的客户、商机、项目组和被授权 KB 文档 | 默认不可跨项目组读取客户敏感资料；导出、外部分享、删除需条件允许 |
| 售前主管 | 管理售前任务分配、方案质量、关键项目支持和权限审批 | 所属部门、所辖项目组、被授权 KA 项目 | 可审批部分分享 / 导出；不可绕过审计访问全部敏感资料 |
| 售后 / 交付 | 负责实施交付、验收、售后问题闭环和交付文档维护 | 已进入交付或售后的项目组、交付资料、客户授权资料 | 不默认访问售前阶段全部商务资料；删除和外部分享需审批 |
| 客户经理 / 销售 | 负责客户关系、商机推进、报价协同和跟进计划 | 本人负责客户、商机、合同前商务材料 | 可读取必要客户与商机信息；不可读取无关技术细节、审计日志或系统配置 |
| 法务 | 负责合同、条款、合规风险和对外文件审阅 | 被指派合同、法务审查材料、相关审计证据 | 可读取合同和审查材料；不可默认导出客户技术资料或修改权限配置 |
| 财务 | 负责报价审核、回款、开票、付款和财务数据核对 | 被授权报价、商务材料、合同财务字段 | 默认不可读取会议纪要、技术环境和客户画像敏感详情；导出需业务原因 |
| 管理员 | 负责账号、角色、配置、项目组和权限回收管理 | 系统管理范围和授权管理对象 | 管理操作必须审计；不能无审计读取或导出客户敏感内容 |
| 安全合规 | 负责敏感资源分级、跨组访问审查、导出 / 分享 / 删除边界和审计复核 | 全局合规视角下的策略、审计、风险处置对象 | 可审计和复核敏感访问；不可替代业务 owner 修改业务内容 |
| 外部访客 | 客户、渠道或外部协作者，通过受控链接或访客账号访问指定资料 | 被显式分享且未过期的低敏或已脱敏资源 | 默认不可访问客户敏感、监管敏感、审计日志、系统配置；不可二次分享 |
| 系统服务账号 | 执行异步任务、索引、审计记录、导出任务和系统集成 | 明确绑定任务所需的最小资源范围 | 只能服务端调用；禁止交互登录；必须记录任务来源和审计链路 |

## 4. 资源类型

| 资源类型 | 默认敏感级别 | 典型 owner | 是否允许跨项目访问 | share / export / delete 边界 |
|---|---|---|---|---|
| KB 文档 | 内部 / 客户敏感 | 知识库管理员、文档上传人、产品负责人 | 条件允许 | share 需按敏感级别控制；export 需记录原因；delete 需 owner 或管理员审批 |
| 客户档案 | 客户敏感 | 客户经理、销售负责人 | 默认拒绝，条件允许 | share / export 需客户 owner 或主管审批；delete 需管理员和审计 |
| 商机 | 内部 / 客户敏感 | 客户经理、销售负责人 | 条件允许 | 跨组 share 需业务原因；export 报表可脱敏；delete 需保留审计 |
| 方案 | 客户敏感 | 售前、售前主管、方案创建人 | 条件允许 | share / export 需项目组内授权；外部分享需水印和有效期 |
| 会议纪要 | 客户敏感 | 会议组织者、项目负责人 | 默认拒绝，条件允许 | export 需脱敏；外部 share 默认拒绝；delete 需 owner 审批 |
| 合同 | 监管敏感 | 法务、销售负责人、财务 | 默认拒绝，条件允许 | share / export 严格审批；delete 默认拒绝，允许归档不允许物理删除 |
| 报价 / 商务材料 | 客户敏感 / 监管敏感 | 客户经理、财务、销售负责人 | 条件允许 | export 需理由；外部 share 需审批和水印；delete 需 owner 审批 |
| 客情画像 | 客户敏感 | 客户经理、销售负责人、售前主管 | 默认拒绝，条件允许 | share 仅限项目组或授权管理链；export 默认拒绝或脱敏导出 |
| 审计日志 | 监管敏感 | 安全合规、管理员 | 默认拒绝 | share / export 仅安全合规审批；delete 拒绝 |
| 系统配置 | 监管敏感 | 管理员、运维负责人 | 默认拒绝 | share / export 拒绝；delete / admin 仅管理员且强审计 |
| 模板 / PPT 资源 | 内部 / 客户敏感 | 售前主管、模板维护人 | 条件允许 | 内部模板可跨组 read；KA / 客户定制模板需授权；export 需标记来源 |
| 外部分享链接 | 客户敏感 / 监管敏感 | 分享创建人、项目负责人 | 默认拒绝，条件允许 | 创建、延长、撤销均需审计；敏感资源默认不允许外部分享 |

## 5. Resource x Operation Matrix

单元格含义：

- 允许：默认可执行，仍需记录必要审计。
- 拒绝：默认不可执行，后续工程不得静默放行。
- 条件允许：满足矩阵后的条件说明，并具备审计记录时可执行。

| 资源类型 | read | write | share | export | delete | admin | audit |
|---|---|---|---|---|---|---|---|
| KB 文档 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 |
| 客户档案 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 拒绝 | 条件允许 |
| 商机 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 拒绝 | 条件允许 |
| 方案 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 拒绝 | 条件允许 |
| 会议纪要 | 条件允许 | 条件允许 | 拒绝 | 条件允许 | 条件允许 | 拒绝 | 条件允许 |
| 合同 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 拒绝 | 拒绝 | 条件允许 |
| 报价 / 商务材料 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 拒绝 | 条件允许 |
| 客情画像 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 拒绝 | 条件允许 |
| 审计日志 | 条件允许 | 拒绝 | 拒绝 | 条件允许 | 拒绝 | 条件允许 | 允许 |
| 系统配置 | 条件允许 | 条件允许 | 拒绝 | 拒绝 | 条件允许 | 条件允许 | 允许 |
| 模板 / PPT 资源 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 |
| 外部分享链接 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 | 条件允许 |

### 条件说明

1. `read` 条件允许：用户需满足同项目组、资源 owner、管理链授权、法务 / 财务 / 合规职责授权或外部访客显式分享链接之一；监管敏感资源默认只允许职责相关角色读取。
2. `write` 条件允许：用户需为资源创建人、owner、项目负责人、对应职责角色或管理员；合同、报价、系统配置写入需保留版本和审计。
3. `share` 条件允许：内部分享需同项目组或主管审批；外部分享只允许资源标记 `external_share_allowed=true`，且非监管敏感、未包含未授权客户资料。
4. `export` 条件允许：必须填写 `context.export_reason`，客户敏感或监管敏感资源需审批、脱敏或水印；外部访客默认不可导出。
5. `delete` 条件允许：仅允许 owner、项目负责人或管理员发起；合同、审计日志默认不可物理删除；客户敏感资源删除需保留审计和恢复窗口。
6. `admin` 条件允许：仅管理员、安全合规或资源域负责人可执行；必须记录操作人、原因、时间、影响范围。
7. `audit` 条件允许：普通用户只可查看本人操作记录；主管可查看所辖项目审计；安全合规和管理员可查看全局审计，但仍需审计其审计行为。

## 6. ABAC 属性维度

### User Attributes

| 属性 | 取值范围 | 示例 | 是否策略必需 | 是否需业务 / 合规确认 |
|---|---|---|---|---|
| `user.role` | 售前、售前主管、售后 / 交付、客户经理 / 销售、法务、财务、管理员、安全合规、外部访客、系统服务账号 | `售前` | 是 | 是 |
| `user.dept` | 部门编码或部门名称 | `pre-sales-east` | 是 | 是 |
| `user.level` | 普通成员、项目负责人、主管、部门负责人、管理员 | `项目负责人` | 是 | 是 |
| `user.project_group` | 一个或多个项目组 ID | `customer-x-pg` | 是 | 是 |
| `user.region` | 华东、华南、华北、海外等区域 | `华东` | 条件必需 | 是 |
| `user.employment_status` | active、inactive、on_leave、terminated | `active` | 是 | 是 |

### Resource Attributes

| 属性 | 取值范围 | 示例 | 是否策略必需 | 是否需业务 / 合规确认 |
|---|---|---|---|---|
| `resource.type` | KB 文档、客户档案、商机、方案、会议纪要、合同、报价 / 商务材料、客情画像、审计日志、系统配置、模板 / PPT 资源、外部分享链接 | `方案` | 是 | 是 |
| `resource.sensitivity` | 公开、内部、客户敏感、监管敏感 | `客户敏感` | 是 | 是 |
| `resource.owner_dept` | 部门编码或名称 | `pre-sales-east` | 是 | 是 |
| `resource.project_group` | 项目组 ID，可为空 | `customer-x-pg` | 是 | 是 |
| `resource.customer_id` | 客户 ID 或脱敏客户标识 | `cust_123` | 条件必需 | 是 |
| `resource.created_by` | 用户 ID 或系统服务账号 ID | `user_456` | 条件必需 | 是 |
| `resource.ka_only` | true、false | `true` | 条件必需 | 是 |
| `resource.external_share_allowed` | true、false | `false` | 条件必需 | 是 |

### Context Attributes

| 属性 | 取值范围 | 示例 | 是否策略必需 | 是否需业务 / 合规确认 |
|---|---|---|---|---|
| `context.time` | 时间戳、工作时间 / 非工作时间 | `2026-06-29T10:00:00+08:00` | 条件必需 | 是 |
| `context.location` | 办公网、VPN、客户现场、未知位置 | `办公网` | 条件必需 | 是 |
| `context.device_trust` | trusted、managed、untrusted | `managed` | 条件必需 | 是 |
| `context.network_zone` | intranet、vpn、public、customer_site | `intranet` | 条件必需 | 是 |
| `context.operation` | read、write、share、export、delete、admin、audit | `export` | 是 | 是 |
| `context.export_reason` | 客户交付、投标材料、内部复核、法务审查、财务归档、其他 | `投标材料` | export 必需 | 是 |

## 7. 项目组隔离规则

1. 项目组边界：项目组是权限隔离的主要业务边界，默认按客户 + 商机 / 交付项目建立；KA 客户可按集团客户、子公司、重点商机或交付项目拆分多个项目组。
2. 分组依据：默认按客户和商机分组；可叠加 KA level、行业、区域、交付项目和特殊合规要求。
3. 组内默认可见：项目组成员可读取与职责相关的内部资源和被授权客户敏感资源；监管敏感资源仍需职责授权。
4. 组外默认可见：默认拒绝。组外用户只能访问公开资源、通用内部模板或被显式分享的脱敏资料。
5. 跨组共享场景：售前主管调配、跨区域支援、法务 / 财务审查、安全合规审计、售后交付接手和集团客户协同可申请跨组共享。
6. 加入项目组：需项目负责人、销售负责人或售前主管授权；加入原因、授权人和有效期应记录。
7. 离开项目组：人员离开项目、离职、转岗或项目结束时应回收项目组权限；保留必要审计和交接记录。
8. 项目组合并：集团客户或商机合并时，应合并成员、资源和审计范围，并保留原项目组来源。
9. 项目组解散：项目终止或归档后，普通成员权限回收；项目负责人、安全合规和管理员保留归档审计访问。
10. 离组后权限恢复：用户再次加入项目组时按新授权重新计算权限，不继承历史临时授权。
11. 跨组 KB 文档：公开或内部通用 KB 可跨组读取；客户敏感 KB 需脱敏或项目 owner 授权；监管敏感 KB 默认不可跨组读取。

## 8. 外部分享 / 导出 / 水印边界

| 场景 | 业务规则 |
|---|---|
| 允许外部分享 | 仅允许 `resource.external_share_allowed=true`、非监管敏感、无未授权客户敏感信息的资源；需设置访问对象、有效期和审计日志 |
| 禁止外部分享 | 合同、审计日志、系统配置、监管敏感资源、未脱敏客户档案、未授权会议纪要、未授权客情画像默认禁止 |
| 导出允许 | 公开和内部资源可按角色导出；客户敏感资源需填写导出原因并保留审计 |
| 导出条件允许 | 客户敏感或商务材料导出需审批、脱敏或水印；监管敏感资源导出需安全合规或法务确认 |
| 导出拒绝 | 审计日志批量导出、系统配置导出、外部访客导出、无理由导出默认拒绝 |
| 水印条件 | 外部分享、客户敏感资源导出、报价 / 合同材料、KA 模板、客户定制方案需要水印 |
| 有效期 | 外部分享链接默认短期有效，建议 7 天以内；延期需重新审批 |
| 访问日志 | 外部访问、导出、下载、撤销、失败访问和管理员操作必须记录 |
| 下载控制 | 外部访客默认只读；下载需资源 owner 或项目负责人授权 |
| 撤销 | 分享创建人、项目负责人、安全合规和管理员可撤销；撤销必须即时生效并记录原因 |
| 访客边界 | 外部访客只能访问被显式分享且未过期资源，不得浏览项目组、客户档案、审计日志或系统配置 |

## 9. 端到端 Trace 场景

### Trace 1：售前访问本项目组 KA 方案模板

- User: `role=售前`, `project_group=客户 X 项目组`, `employment_status=active`
- Resource: `type=方案`, `project_group=客户 X 项目组`, `ka_only=true`, `sensitivity=客户敏感`
- Operation: `read`
- Context: `network_zone=intranet`, `device_trust=managed`
- Expected decision: 条件允许
- Reason: 用户属于同项目组，但 KA 模板需要售前主管或项目负责人授权。
- Referenced rule: `resource.project_group` + `resource.ka_only` + `user.role`

### Trace 2：客户经理导出跨项目组客户档案

- User: `role=客户经理 / 销售`, `project_group=客户 A 项目组`, `region=华东`
- Resource: `type=客户档案`, `project_group=客户 B 项目组`, `sensitivity=客户敏感`
- Operation: `export`
- Context: `export_reason=内部复核`, `network_zone=vpn`
- Expected decision: 拒绝
- Reason: 客户档案默认按项目组隔离，用户不属于客户 B 项目组，且没有 owner / 主管审批。
- Referenced rule: 客户档案 matrix `export=条件允许`，项目组隔离规则 3-5

### Trace 3：法务审查合同并导出审查副本

- User: `role=法务`, `dept=legal`, `employment_status=active`
- Resource: `type=合同`, `sensitivity=监管敏感`, `owner_dept=sales-east`
- Operation: `export`
- Context: `export_reason=法务审查`, `device_trust=managed`, `network_zone=intranet`
- Expected decision: 条件允许
- Reason: 法务职责授权可处理合同审查，导出需记录原因、版本和审计，且不得外部分享。
- Referenced rule: 合同 matrix `export=条件允许`，`context.export_reason`

### Trace 4：外部访客访问已过期方案分享链接

- User: `role=外部访客`
- Resource: `type=外部分享链接`, `resource.external_share_allowed=true`, `sensitivity=客户敏感`
- Operation: `read`
- Context: `time=链接过期后`, `network_zone=public`, `device_trust=untrusted`
- Expected decision: 拒绝
- Reason: 外部访客只能访问被显式分享且未过期的资源；过期链接必须拒绝并记录访问失败。
- Referenced rule: 外部分享 / 导出 / 水印边界：有效期、访问日志、访客边界

### Trace 5：安全合规查看审计日志

- User: `role=安全合规`, `dept=compliance`, `employment_status=active`
- Resource: `type=审计日志`, `sensitivity=监管敏感`
- Operation: `audit`
- Context: `operation=audit`, `network_zone=intranet`, `device_trust=managed`
- Expected decision: 允许
- Reason: 安全合规具备审计职责，但其审计行为也必须被记录。
- Referenced rule: 审计日志 matrix `audit=允许`，条件说明 7

### Trace 6：管理员删除审计日志

- User: `role=管理员`, `level=管理员`
- Resource: `type=审计日志`, `sensitivity=监管敏感`
- Operation: `delete`
- Context: `operation=delete`, `network_zone=intranet`
- Expected decision: 拒绝
- Reason: 审计日志不允许物理删除；管理员只能按合规流程归档或配置保留策略。
- Referenced rule: 审计日志 matrix `delete=拒绝`

### Trace 7：售后交付接手售前项目资料

- User: `role=售后 / 交付`, `project_group=客户 X 交付组`, `employment_status=active`
- Resource: `type=会议纪要`, `project_group=客户 X 售前组`, `sensitivity=客户敏感`
- Operation: `read`
- Context: `operation=read`, `network_zone=intranet`, `device_trust=managed`
- Expected decision: 条件允许
- Reason: 交付接手是允许跨组场景，但需要项目负责人授权并限定资料范围。
- Referenced rule: 项目组隔离规则 5、会议纪要 matrix `read=条件允许`

## 10. 禁止规则 / 非目标

本文档不批准以下行为：

- 无审计的 blanket admin access。
- 不受限制的批量导出。
- 不受限制的外部分享。
- 默认跨项目组可见。
- 删除审计日志。
- 向外部访客暴露客户敏感文档、监管敏感资源、审计日志或系统配置。
- 用系统服务账号进行交互登录。
- 在本 PR 中实现 ABAC / OPA / ACL / policy evaluator / permission middleware / project-group isolation runtime。

## 11. 后续解锁条件

- [ ] 业务负责人确认角色、资源类型和默认权限矩阵。
- [ ] 安全合规确认敏感资源分级、跨组访问、导出 / 分享 / 删除边界。
- [ ] 售前主管确认权限粒度不会阻碍日常售前工作。
- [ ] 至少 5 个端到端 trace 覆盖跨组、跨角色、跨敏感度、分享 / 导出、审计 / 删除。
- [ ] 后续工程任务明确只使用本文档确认后的权限规则。

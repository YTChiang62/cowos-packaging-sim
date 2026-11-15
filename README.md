# APEX-3D 封装试点线

CoWoS 类（Chip-on-Wafer-on-Substrate）先进封装**培训原型**。虚构厂区「APEX-3D 封装试点线」，不是任何真实晶圆厂或原厂产品的数字孪生，也不会写回 MES / ERP。CoWoS 仅为工艺族通称。

## 如何打开

本页使用 ES modules，请用本地静态服务器，不要直接用 `file://` 打开。

```bash
cd /workspace/cowos-packaging-sim
python3 -m http.server 8765
```

浏览器访问：<http://127.0.0.1:8765/>

## 可玩内容

- 默认训练品：HBX-100（1 逻辑 KGD + 4 叠 HBM → 硅中介层 CoW → 有机基板 WoS）
- 完整走站：来料／晶粒仓 → 电浆与混合键合 → 底部填充／模封／研磨／CoW 测试 → 切割换载具 → 倒装／底部填充／盖板／植球／C-SAM → 终测／刻印／包装
- MES 节拍：prepare → 搬送 → job in → process → job out → track out（可整站推进或逐步）
- 载具变化：300 mm FOUP → 晶粒仓 → 基板 magazine → JEDEC tray
- 跑程问题（无／少量／多）：KGD 短缺、键合偏移、底部填充空洞、基板翘曲；以 OCAP 选择重工／报废／等待补料／PE 签核放行
- 角色：MFG / EE / PE（PE 签核需切到 PE）
- 镜头：轨道旋转、总览、跟随批次、跳至当前站；点击机台查看区域／配方／在制批
- 界面：繁体中文为主，可切换简体、English

Three.js 已放在 `vendor/`，无需外网即可演示。

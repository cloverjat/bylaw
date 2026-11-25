import { dyn } from './i18n-dyn.mjs';
// English / Chinese (Simplified). Static page text is swapped in place; the choice is remembered on this device.
export const ZH = {
  'Escrow': '托管',
  'Safe deals and contracts': '安全的交易与合同',
  'Escrow (agreements)': '托管（协议）',
  'Your agreement': '你的协议',
  '1. Seller accepts': '1. 卖方接受',
  '2. Buyer locks the money': '2. 买方锁定资金',
  '3. Buyer approves': '3. 买方确认',
  '4. Money released': '4. 资金放款',
  'For buying something, hiring someone or signing a deal between two people. Write the terms, and the money only moves by the rule: the seller accepts, the buyer locks the money, and it is released only when the buyer approves. If the deadline passes without approval, it goes back to the buyer.': '适用于买东西、雇人或两个人之间签订协议。写下条款，资金只按规则流动：卖方接受，买方锁定资金，只有买方确认后才会放款。如果截止时间到了仍未确认，资金会退回给买方。',
  'Deal name': '交易名称',
  'e.g. Plot 7 purchase': '例如：7 号地块购买',
  "Seller's wallet address": '卖方钱包地址',
  'Deadline: how long can the buyer wait for delivery?': '截止时间：买方最多等待交付多久？',
  'Terms of the deal (both sides read the same text)': '交易条款（双方阅读的是同一段文字）',
  'e.g. Seller delivers the signed land documents for plot 7 within 7 days. Buyer approves when they receive them.': '例如：卖方在 7 天内交付 7 号地块的已签署文件。买方收到后确认。',
  'Review the agreement': '查看协议',
  'Creating it costs a small amount of OKB for network gas. The terms are fixed after this. Send the link to the seller so they can accept.': '创建需要少量 OKB 作为网络手续费。之后条款将固定不变。请把链接发给卖方，让他们接受。',
  "This cannot be edited or undone. I checked the seller's wallet address, the amount and the terms.": '此操作无法修改或撤销。我已核对卖方的钱包地址、金额和条款。',
  'Create agreement (your wallet will ask you to confirm)': '创建协议（钱包会请你确认）',
  'Home': '首页',
  'Experimental and unaudited. Start with a small amount. Rules cannot be edited after you create them.': '实验性产品，未经审计。请先用小额试用。规则创建后无法修改。',
  'Connect wallet': '连接钱包',
  'Rules your money': '让你的钱',
  "can't break.": '只守规则。',
  'Save, pay and split money with rules locked on the blockchain. No middleman. No cheating. Not the organizer, not even us.': '用锁定在区块链上的规则来储蓄、付款和分账。没有中间人，无法作弊。组织者不能，我们也不能。',
  'Create a rule →': '创建规则 →',
  'Explore the rules': '查看规则',
  'Savings Circle': '储蓄圈',
  'Save together': '一起存钱',
  'Payroll': '工资发放',
  'Automate payments': '自动付款',
  'Bylaw Wallet': 'Bylaw 钱包',
  'Rule-based wallet': '规则钱包',
  'Rule Lab': '规则实验室',
  'See how rules work': '看规则如何运作',
  'How it works': '运作方式',
  'Pick a rule': '选择规则',
  'Like "everyone pays, then one person gets the pot, in turn." You read it in plain words.': '例如“每人先付款，然后轮流由一人领取全部资金”。规则用大白话写出来，一看就懂。',
  'We prove it': '我们来验证',
  "The rule is checked against every possible case, so it can't hide a trick.": '规则会对所有可能的情况逐一检查，所以不可能暗藏花招。',
  'Locked for good': '永久锁定',
  'It goes on X Layer. After that nobody can change it, and the money follows the rule automatically.': '规则部署在 X Layer 上。此后任何人都无法修改，资金会自动按规则流转。',
  'Find your circle or payroll': '查找你的储蓄圈或工资单',
  'Paste the address or link someone shared with you. Your own circles and payrolls on this device are listed below.': '粘贴别人分享给你的地址或链接。你在这台设备上创建的储蓄圈和工资单会显示在下方。',
  'Open': '打开',
  'Nothing here yet. Create a circle or a payroll below, or': '这里还没有内容。请在下方创建储蓄圈或工资单，或',
  'look at a finished example': '查看一个完成的示例',
  'Savings circle': '储蓄圈',
  'A real circle, running right now with real (tiny) amounts. Everyone pays in each round, and the rule decides who gets the pot.': '这是一个正在运行的真实储蓄圈，金额很小。每一轮每个人都要付款，由规则决定谁领取资金池。',
  'Connect your wallet to start': '连接钱包后开始',
  'Circle address': '储蓄圈地址',
  'Load circle': '加载储蓄圈',
  'Create your own circle': '创建你自己的储蓄圈',
  'Set it up once, in plain words. After you create it, nobody can change it, not even you.': '只需设置一次，用大白话描述。创建之后，任何人都无法修改，包括你自己。',
  'Circle name': '储蓄圈名称',
  '+ Add a member': '+ 添加成员',
  'How much does each person pay per round? (USDC)': '每人每轮付多少？（USDC）',
  'How long is each round?': '每一轮多长时间？',
  'minutes': '分钟',
  'hours': '小时',
  'days': '天',
  'Review my circle': '检查我的储蓄圈',
  'Creating the circle costs a small amount of OKB for network gas. This cannot be undone or edited later.': '创建储蓄圈需要少量 OKB 作为网络手续费。创建后无法撤销或修改。',
  'This cannot be edited or undone.': '此操作无法修改或撤销。',
  'I checked every wallet address and amount. A wrong address cannot be fixed after this circle is created.': '我已核对每个钱包地址和金额。储蓄圈创建后，填错的地址无法更正。',
  'Create circle (your wallet will ask you to confirm)': '创建储蓄圈（钱包会请你确认）',
  'Pay your team (Payroll)': '给团队发工资',
  'Your payroll': '你的工资单',
  'Connect your wallet': '连接你的钱包',
  "Set it once, then it is locked. Choose your workers, what each is paid per cycle, how often, and for how many cycles. You put in the full amount one time. Each worker's pay is released at the end of each cycle by a public rule. Nobody can change it, not even you. Anything the workers never claim can come back to you only 90 days after the last cycle.": '只需设置一次，之后即被锁定。选择收款人、每个周期的金额、发放频率和周期数。你一次性存入全部金额，每个周期结束时由公开规则自动发放。任何人都无法修改，包括你自己。收款人未领取的部分，只有在最后一个周期结束 90 天后才能退回给你。',
  'Payroll name': '工资单名称',
  '+ Add a worker': '+ 添加收款人',
  'How long is each pay cycle?': '每个发放周期多长？',
  'How many cycles? (1 to 15)': '共几个周期？（1 到 15）',
  'Review my payroll': '检查我的工资单',
  'Creating costs a little OKB for gas. After creating, you fund it in a second step. Terms can never be edited.': '创建需要少量 OKB 作为手续费。创建后，你需要再用第二步存入资金。条款永远无法修改。',
  'I checked every wallet address and amount. A wrong address cannot be fixed after this payroll is created.': '我已核对每个钱包地址和金额。工资单创建后，填错的地址无法更正。',
  'Create payroll (your wallet will ask you to confirm)': '创建工资单（钱包会请你确认）',
  'Your Bylaw Wallet': '你的 Bylaw 钱包',
  'Put money in (USDC). Anyone can add money; only the owner can take it out, and only through the rule.': '存入资金（USDC）。任何人都可以存入，只有所有者可以取出，而且必须符合规则。',
  'Add USDC to this wallet': '向此钱包存入 USDC',
  'You are connected, but this wallet belongs to someone else. You can add money or confirm payments if you are the chosen second person.': '你已连接，但这个钱包属于别人。你可以存入资金；如果你是指定的第二确认人，也可以确认付款。',
  'Send money': '转账',
  'Recipient wallet address': '收款钱包地址',
  'Amount (USDC)': '金额（USDC）',
  'Above your limit, this creates a request that the second person must confirm first.': '超过额度时，会生成一个请求，需要第二确认人先确认。',
  'Send (the public rule checks it first)': '发送（公开规则会先检查）',
  'Save this recipient as trusted': '将此收款人保存为可信',
  'A saved recipient becomes trusted after 2 days.': '保存的收款人在 2 天后成为可信收款人。',
  'Payments waiting for confirmation': '等待确认的付款',
  'Create a Bylaw Wallet': '创建 Bylaw 钱包',
  'A wallet that holds USDC and only sends it when a public rule says yes. Even if your key is stolen, it can only do what the rule allows. You choose the rule once and it is locked. Experimental: start with a small amount.': '这个钱包持有 USDC，只有公开规则允许时才会转出。即使你的私钥被盗，对方也只能做规则允许的事。规则只需选择一次，之后即被锁定。实验性产品：请先用小额试用。',
  'Wallet name': '钱包名称',
  'Rule': '规则',
  'How big is one step?': '一个单位是多少？',
  'Limit': '额度',
  'Waiting time for a new recipient (hours, 0 to 63)': '新收款人的等待时间（小时，0 到 63）',
  'Wallet address of the second person who must confirm big payments': '需要确认大额付款的第二人的钱包地址',
  'Review my wallet': '检查我的钱包',
  'Creating costs a little OKB for network gas. Limits are counted in whole steps, from 1 to 63 steps. The rule cannot be edited after creation.': '创建需要少量 OKB 作为网络手续费。额度以整数单位计算，范围为 1 到 63 个单位。规则创建后无法修改。',
  "I checked the rule, the limits and the second person's address. Only the wallet that creates this wallet can send from it.": '我已核对规则、额度和第二确认人的地址。只有创建此钱包的账户才能从中转出资金。',
  'Create wallet (your wallet will ask you to confirm)': '创建钱包（钱包会请你确认）',
  'Rule lab': '规则实验室',
  'Pick a rule to see what it does. Every rule is checked against all possible cases before it is locked.': '选择一条规则，看看它的作用。每条规则在锁定前都会对所有可能的情况进行检查。',
  'Choose a rule': '选择规则',
  'Show the technical proof': '查看技术证明',
  'Proof certificate': '证明证书',
  'Experimental and unaudited. Use only money you can afford to lose. Not affiliated with OKX or TapeOut. The proof shows the circuit matches the rule you read; it cannot tell whether the rule is what you meant. Everything on a circle is public on the blockchain. Questions or problems:': '实验性产品，未经审计。请只使用你亏得起的资金。与 OKX 和 TapeOut 无关联。证明只能说明电路与你读到的规则一致，无法判断规则是否符合你的本意。储蓄圈上的一切都公开在区块链上。如有问题：',
  'Fees': '费用',
  // rules, wallet options
  "Daily spending cap": "每日支出上限",
  "Trusted recipients, small first payments": "可信收款人，新收款人仅限小额",
  "Big payments need a second person": "大额付款需要第二人确认",
  "Confirm big payments": "大额付款确认",
  "Savings circle payout": "储蓄圈派发",
  "1 USDC": "1 USDC",
  "5 USDC": "5 USDC",
  "10 USDC": "10 USDC",
  "100 USDC": "100 USDC",
  "Daily cap (in steps)": "每日上限（单位数）",
  "The most this wallet can send in one day, in total.": "这个钱包一天内最多可转出的总额。",
  "Most a brand-new recipient can get (in steps)": "全新收款人最多可收到（单位数）",
  "Saved recipients become trusted after 2 days. Until then, and for new ones, this is the limit.": "保存的收款人 2 天后成为可信。在此之前以及对新收款人，以此为上限。",
  "Payments up to this go straight through (in steps)": "不超过此额度的付款直接通过（单位数）",
  "Anything above this needs the second person.": "超过此额度需要第二人确认。",
  "What it does:": "作用：",
  "Example:": "示例：",
  "Who it's for:": "适合谁：",
  "Live": "已上线",
  "Live on X Layer. Try it above.": "已在 X Layer 上线。可在上方试用。",
  "Live on X Layer. Create a Bylaw Wallet with this rule in the section above.": "已在 X Layer 上线。可在上方创建使用此规则的 Bylaw 钱包。",
  "Friends each pay the same amount every round. The whole pot goes to one member per round, in turn, straight to their wallet.": "朋友们每轮各付相同的金额。每一轮整个资金池轮流直接发到一位成员的钱包。",
  "5 friends pay 10 USDC a month. In month 1, friend 1 gets 50 USDC. In month 2, friend 2 gets it, and so on.": "5 位朋友每月各付 10 USDC。第 1 个月朋友 1 领取 50 USDC，第 2 个月朋友 2 领取，依此类推。",
  "Friends, family, coworkers and communities who save together (a rotating savings group, also called a ROSCA).": "一起存钱的朋友、家人、同事和社区（轮转储蓄小组，也称 ROSCA）。",
  "A wallet cannot spend more than a set amount per day. A payment that would go over the cap is refused.": "钱包每天支出不能超过设定的金额。会超出上限的付款会被拒绝。",
  "A team wallet with a 50 USDC daily cap. If someone steals the key, they can only take 50 a day.": "团队钱包设置每日 50 USDC 上限。即使私钥被盗，对方一天最多只能拿走 50。",
  "Teams and businesses that share a wallet.": "共用一个钱包的团队和企业。",
  "Paying a saved, trusted address is always fine. A brand-new address can only get small amounts, and only after a waiting time.": "向已保存的可信地址付款始终没问题。全新地址只能收到小额，而且要等待一段时间。",
  "Pay your supplier freely. A new address can get at most 5 USDC, and only after 24 hours.": "向供应商付款不受限制。新地址最多只能收到 5 USDC，而且要等 24 小时。",
  "Anyone worried about typing the wrong address or being scammed.": "担心输错地址或被骗的任何人。",
  "Small payments go through. Anything above your limit needs a second confirmation first.": "小额付款直接通过。超过额度的付款需要先经过第二人确认。",
  "Staff can pay up to 20 USDC. Above that, the owner must also confirm.": "员工最多可付 20 USDC。超过后，所有者也必须确认。",
  "Businesses that want a second pair of eyes on big payments.": "希望大额付款有人再把关的企业。",
  // glossary, progress, account
  "1. Fill it in": "1. 填写",
  "2. Review": "2. 检查",
  "3. Confirm in your wallet": "3. 在钱包中确认",
  "What these words mean": "这些词是什么意思",
  "A small program on the blockchain that decides when money can move. You read it in plain words, and nobody can change it after it is locked.": "区块链上的一段小程序，决定资金何时可以转移。规则用大白话写出，锁定后任何人都无法修改。",
  "A group saving plan. Everyone pays the same amount each round, and the whole pot goes to one member per round, in turn.": "一种集体储蓄方案。每一轮每人付相同的金额，整个资金池轮流发给其中一位成员。",
  "Pay for a team, released automatically at the end of each cycle by a public rule.": "给团队发工资，每个周期结束时由公开规则自动发放。",
  "Step": "单位",
  "The unit a wallet limit is counted in. If one step is 5 USDC, a limit of 10 steps means 50 USDC.": "钱包额度的计数单位。如果一个单位是 5 USDC，10 个单位的额度就是 50 USDC。",
  "Proof": "证明",
  "A check that the rule behaves correctly for every possible case before it is locked.": "在规则锁定前，对所有可能的情况检查规则是否正确运行。",
  "A digital dollar. One USDC is worth one US dollar.": "一种数字美元。1 USDC 价值 1 美元。",
  "The blockchain where Bylaw rules live. It is run by OKX.": "Bylaw 规则所在的区块链，由 OKX 运营。",
  "Gas (OKB)": "手续费（OKB）",
  "A small network fee, paid in OKB, to record something on X Layer.": "在 X Layer 上记录一笔操作所需的少量网络费用，用 OKB 支付。",
  "Wallet address": "钱包地址",
  "Your public account number. It starts with 0x. Anyone can send money to it, but only you can spend from it.": "你的公开账号，以 0x 开头。任何人都可以向它转入，但只有你可以从中支出。",
  "Rule": "规则",
  "Circle": "储蓄圈",
  "Your wallet is your account. There is no password and no email.": "你的钱包就是你的账户。没有密码，也不需要邮箱。",
  "Activity": "动态",
  "The last hour, kept on this device.": "最近一小时的记录，保存在这台设备上。",
  "Full history on the explorer": "在区块浏览器查看完整历史",
  "No activity in the last hour.": "最近一小时没有动态。",
  // splash + language
  'Loading': '加载中',
  'Rules your money can\'t break.': '让你的钱只守规则。',
  'Money rules that live on the blockchain. You read them in plain words, they are checked against every case, and then nobody can change them.': '把资金规则放到区块链上。规则用大白话写出，经过所有情况的验证，之后任何人都无法修改。',
  'Enter Bylaw': '进入 Bylaw',
  'Read the rules': '阅读规则',
  'Experimental and unaudited. Use only money you can afford to lose.': '实验性产品，未经审计。请只使用你亏得起的资金。',
  'Built on X Layer': '构建于 X Layer',
  // wallet picker
  'Choose your wallet': '选择钱包',
  'Other wallets (WalletConnect)': '其他钱包（WalletConnect）',
  'Cancel': '取消',
  'Connect a wallet': '连接钱包',
  'Or open this page inside your wallet app, then press Connect again.': '或者在钱包应用中打开本页面，再点击连接。',
  'Copy page link': '复制页面链接',
  'Link copied': '链接已复制',
};
export const ZH_PLACEHOLDER = {
  'Paste a circle or payroll address (0x...) or link': '粘贴储蓄圈或工资单的地址（0x...）或链接',
  'e.g. Family savings': '例如：家庭储蓄',
  'e.g. Studio team, November': '例如：工作室团队，11 月',
  'e.g. 5': '例如：5',
  'e.g. 3': '例如：3',
  'Name': '姓名',
  'USDC per cycle': '每个周期的 USDC 金额',
  'Wallet address (0x...)': '钱包地址（0x...）',
  '0x...': '0x...',
  'e.g. Team spending': '例如：团队开支',
};

let lang = 'en';
const flat = (s) => s.replace(/\s+/g, ' ').trim();
export const getLang = () => lang;
export function t(s) { if (lang !== 'zh') return s; return ZH[flat(s)] || dyn(flat(s)) || s; }

function xlate(node) {
  const raw = node.nodeValue; const key = flat(raw);
  if (!key) return;
  if (lang === 'zh') {
    const z = ZH[key] || dyn(key);
    if (z) { if (node.__en === undefined) node.__en = raw; node.nodeValue = (raw.match(/^\s*/)[0]) + z + (raw.match(/\s*$/)[0]); }
  } else if (node.__en !== undefined) { node.nodeValue = node.__en; delete node.__en; }
}
function walk(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => /^(SCRIPT|STYLE|PRE|TEXTAREA)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const list = []; while (w.nextNode()) list.push(w.currentNode);
  list.forEach(xlate);
  if (root.querySelectorAll) root.querySelectorAll('[placeholder]').forEach((el) => {
    const p = el.getAttribute('placeholder');
    if (lang === 'zh' && ZH_PLACEHOLDER[p]) { el.__ph = p; el.setAttribute('placeholder', ZH_PLACEHOLDER[p]); }
    else if (lang !== 'zh' && el.__ph) { el.setAttribute('placeholder', el.__ph); delete el.__ph; }
  });
}

export function setLang(l) {
  lang = l === 'zh' ? 'zh' : 'en';
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  try { localStorage.setItem('bylaw_lang', lang); } catch {}
  walk(document.body);
  document.querySelectorAll('[data-lang-btn]').forEach((b) => { b.textContent = lang === 'zh' ? 'EN' : '中文'; });
}

export function initI18n() {
  let saved = null; try { saved = localStorage.getItem('bylaw_lang'); } catch {}
  const guess = saved || ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
  new MutationObserver((muts) => { if (lang !== 'zh') return; for (const m of muts) for (const n of m.addedNodes) { if (n.nodeType === 3) xlate(n); else if (n.nodeType === 1) walk(n); } }).observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('[data-lang-btn]').forEach((b) => b.addEventListener('click', () => setLang(lang === 'zh' ? 'en' : 'zh')));
  if (guess === 'zh') setLang('zh');
}

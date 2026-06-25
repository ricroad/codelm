export type AppMode = "overview" | "learn" | "generalize";
export type LearnVariant = "A" | "B" | "C";
export type GeneralizeVariant = "X" | "Y" | "Z";

export interface DesignState {
  mode: AppMode;
  variant: LearnVariant;
  genVar: GeneralizeVariant;
  collapsed: boolean;
  submitted: boolean;
  genSubmitted: boolean;
}

export type DesignAction =
  | { type: "setMode"; mode: AppMode }
  | { type: "setVariant"; variant: LearnVariant }
  | { type: "setGeneralizeVariant"; genVar: GeneralizeVariant }
  | { type: "setCollapsed"; collapsed: boolean }
  | { type: "setSubmitted"; submitted: boolean }
  | { type: "setGeneralizeSubmitted"; genSubmitted: boolean }
  | { type: "resetLearn" }
  | { type: "resetGeneralize" };

export const defaultDesignState: DesignState = {
  mode: "overview",
  variant: "A",
  genVar: "X",
  collapsed: false,
  submitted: false,
  genSubmitted: false,
};

export const MODE_LABELS: Record<AppMode, string> = {
  overview: "概览",
  learn: "学习",
  generalize: "泛化",
};

export const MODE_HEADINGS: Record<AppMode, string> = {
  learn: "讲解 → 理解 → 讲回去 → 对齐，往复直至学会",
  overview: "主干据依赖图生成，支线据你的薄弱点动态生长",
  generalize: "泛化 · 把学过的模式用到新场景，串讲整条链路",
};

export const OVERVIEW_CAPTION =
  "学习路径的家：左侧大纲讲『学什么、什么顺序、走到哪』，右侧把图谱画成一条可走的路线图。";

export const LEARN_VARIANTS: Record<
  LearnVariant,
  { label: string; title: string; description: string }
> = {
  A: {
    label: "A · 对话式",
    title: "导师对话",
    description: "右栏像和导师聊天，点评、逐点对照和追问作为一条结构化消息返回。",
  },
  B: {
    label: "B · 专注讲台",
    title: "专注讲台",
    description: "图谱暂退，中央亮色弹层让你对着真实源码专心讲。",
  },
  C: {
    label: "C · 实时对齐",
    title: "实时对齐",
    description: "你的讲解与代码真相清单并排逐点 diff，顶部显示收敛度。",
  },
};

export const GENERALIZE_VARIANTS: Record<
  GeneralizeVariant,
  { label: string; title: string; prompt: string }
> = {
  X: {
    label: "X · 情景推演",
    title: "情景推演",
    prompt: "新场景：拖参考图 + 提示词点『生成视频』，把链路从点击到出片串讲一遍。",
  },
  Y: {
    label: "Y · 反事实",
    title: "反事实",
    prompt: "反事实：删掉 commands 层，让 hook 直接 fetch 模型，会坏在哪？请讲清后果链。",
  },
  Z: {
    label: "Z · 教新人",
    title: "教新人",
    prompt: "新人追问：为什么不直接在按钮点击里调模型 API？讲到他能复述为止。",
  },
};

export function getModeHeading(mode: AppMode): string {
  return MODE_HEADINGS[mode];
}

export function getVariantLabel(variant: LearnVariant): string {
  return LEARN_VARIANTS[variant].label;
}

export function getGeneralizePrompt(genVar: GeneralizeVariant): string {
  return GENERALIZE_VARIANTS[genVar].prompt;
}

export function applyDesignAction(state: DesignState, action: DesignAction): DesignState {
  switch (action.type) {
    case "setMode":
      return {
        ...state,
        mode: action.mode,
        variant: action.mode === "learn" ? state.variant : "A",
        genVar: action.mode === "generalize" ? state.genVar : "X",
        submitted: false,
        genSubmitted: false,
      };
    case "setVariant":
      return { ...state, variant: action.variant, submitted: false, collapsed: false };
    case "setGeneralizeVariant":
      return { ...state, genVar: action.genVar, genSubmitted: false };
    case "setCollapsed":
      return { ...state, collapsed: action.collapsed };
    case "setSubmitted":
      return { ...state, submitted: action.submitted };
    case "setGeneralizeSubmitted":
      return { ...state, genSubmitted: action.genSubmitted };
    case "resetLearn":
      return { ...state, submitted: false };
    case "resetGeneralize":
      return { ...state, genSubmitted: false };
  }
}

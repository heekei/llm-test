declare module 'element-plus/dist/locale/zh-cn.mjs' {
  const zhCn: Record<string, unknown>;
  export default zhCn;
}

declare module 'element-plus/dist/locale/en.mjs' {
  const en: Record<string, unknown>;
  export default en;
}

declare module '*.vue' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

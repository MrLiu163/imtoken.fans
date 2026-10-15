"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isTrackablePath } from "@/lib/analytics";

/**
 * 访问埋点。挂在根 layout 里，本身不渲染任何东西。
 *
 * 为什么必须放在客户端：App Router 的站内跳转是客户端路由，
 * 不会重新执行 layout / page 的服务端渲染，所以服务端数不到这些访问。
 * usePathname 是唯一能可靠感知"用户翻到了下一页"的地方。
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  // 上一次真正上报过的路径。挡两种重复：
  //   1. 开发环境 StrictMode 下 effect 会跑两遍
  //   2. 路径没变但组件因为别的原因重渲染
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || !isTrackablePath(pathname)) return;
    if (lastSent.current === pathname) return;

    // 只在整份文档的第一次上报时带 referrer。
    // document.referrer 在客户端路由跳转后不会变，一直是最初那个外链——
    // 每翻一页都带上的话，"流量来源"里那个外链会被重复计十几次。
    const isFirstView = lastSent.current === null;
    lastSent.current = pathname;

    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referrer: isFirstView ? document.referrer || null : null,
      }),
      // keepalive：用户点完链接马上跳走时，请求不会被取消。
      keepalive: true,
    }).catch(() => {
      // 埋点失败就失败了，不重试、不提示。控制台干净比数字精确重要。
    });
  }, [pathname]);

  return null;
}

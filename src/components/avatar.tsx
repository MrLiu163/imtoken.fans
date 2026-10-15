"use client";

import { useState } from "react";

// 全站统一的头像组件。核心是「永远不要出现浏览器的裂图图标」：
// 只要图片加载失败（外链被墙、图片被删、URL 过期），就自动退回首字母占位。
// className 由调用方给（尺寸 + 占位底色），组件只负责加载和降级这件事。
export function Avatar({
  src,
  name,
  className = "",
  imgClassName = "h-full w-full object-cover",
  as: Tag = "span",
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
  imgClassName?: string;
  /** 放在 <p>、<button> 这类不能嵌 div 的地方时保持 span（默认就是 span）。 */
  as?: "span" | "div";
}) {
  // 记住「哪个 src 挂了」而不是单纯的 boolean：src 换成新的时自动重新尝试加载。
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initial = (name?.trim() || "?").slice(0, 1).toUpperCase();
  const usable = src && src !== failedSrc;

  return (
    <Tag className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      {usable ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={imgClassName}
          // 有些图床（含 Google 的头像 CDN）对带 Referer 的跨站请求会返回 403，去掉更稳。
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        initial
      )}
    </Tag>
  );
}

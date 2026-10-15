import type { User } from "@supabase/supabase-js";

export type AuthMethod = "google" | "wallet" | "password";

export interface SessionUser {
  name: string;
  identifier: string;
  method: AuthMethod;
}

// 纯函数，不依赖 React：客户端的 AuthProvider 和服务端的 Profile 页都要用同一套推导逻辑。
export function deriveUser(user: User | null): SessionUser | null {
  if (!user) return null;

  const walletAddress = user.user_metadata?.wallet_address as string | undefined;
  if (walletAddress) {
    return {
      name: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      identifier: walletAddress,
      method: "wallet",
    };
  }

  const provider = user.app_metadata?.provider;
  if (provider === "google") {
    return {
      // 兜底用 "Google" 而不是"Google 用户"：这是个纯函数，拿不到当前语言，
      // 所以最后一档用语言中立的写法（正常情况下前面几档一定命中）。
      name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email || "Google",
      identifier: user.email ?? "",
      method: "google",
    };
  }

  const username = user.user_metadata?.username as string | undefined;
  if (user.user_metadata?.auth_method === "username" && username) {
    // 用户名注册走的是内部合成邮箱，不应该把它展示给用户看
    return { name: username, identifier: `@${username}`, method: "password" };
  }

  return {
    // 同上，最后一档退到账号 id 前 8 位（和钱包分支的缩写地址一个思路），不写中文。
    name: username || user.email?.split("@")[0] || user.id.slice(0, 8),
    identifier: user.email ?? "",
    method: "password",
  };
}

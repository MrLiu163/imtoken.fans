import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/profile";
import { getCheckinState, getLotteryState } from "@/lib/activities";
import { CheckinCard } from "@/components/checkin-card";
import { LotteryWheel } from "@/components/lottery-wheel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("activitiesTitle"),
    description: t("activitiesDescription"),
  };
}

// 活动页只放"能动手玩的东西"：签到 + 抽奖，两块都是整页宽，自上而下排。
// 没有页面级大标题——「每日签到」「幸运抽奖」这两个板块标题本身就够当分区标题了，
// 再套一层"活动中心 / 签到领经验、抽奖赢奖品"只是把同一句话说两遍。
// 经验条在个人主页，经验值和等级规则在 FAQ，这里都不重复。
//
// 对游客也开放：奖品、概率、签到节奏都能看，只是参与要先登录。
// "看得见但要登录才能玩"比直接挡在登录页外面更能把人留下来。
// 页面顶部不再单独放一条"登录后可以签到、抽奖"——两个卡片各自的按钮位置已经写着
// 「登录后签到」「登录后抽奖」了，顶上再说一遍是同一句话说三遍。
export default async function ActivitiesPage() {
  const profile = await getCurrentProfile();
  const userId = profile?.id ?? null;

  const [checkin, lottery] = await Promise.all([getCheckinState(userId), getLotteryState(userId)]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <CheckinCard state={checkin} isLoggedIn={Boolean(profile)} />

      <LotteryWheel
        prizes={lottery.prizes}
        settings={lottery.settings}
        tickets={lottery.tickets}
        drawsLeft={lottery.drawsLeft}
        recentWinners={lottery.recentWinners}
        isLoggedIn={Boolean(profile)}
      />
    </div>
  );
}

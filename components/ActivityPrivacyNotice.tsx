import { EyeOff } from "lucide-react";

// GitHub zeroes out contributionsCollection for every viewer but the owner when
// an account's activity is set to private (see Card.hiddenActivity) — this
// stats card is likely underscored for a reason that has nothing to do with
// the person's real output. Shown on the scout report and duel pages, never
// baked into the capturable card art (share images shouldn't carry a caveat
// about the very numbers printed on them).
export default function ActivityPrivacyNotice({
  login,
  compact = false,
}: {
  login: string;
  compact?: boolean;
}) {
  const message = `GitHub shows zero contribution activity for @${login} - the profile might be private. Stats below might run low.`;

  if (compact) {
    return (
      <div
        role="status"
        title={message}
        className="flex items-center gap-[4px] text-[10.5px] leading-none text-gold-hi"
      >
        <EyeOff size={11} aria-hidden />
        activity private
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mx-auto flex max-w-[560px] items-start gap-[9px] rounded-[10px] border border-gold/30 bg-gold/[0.08] px-[13px] py-[10px] text-[12.5px] leading-snug text-gold-hi"
    >
      <EyeOff size={15} className="mt-[1px] shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

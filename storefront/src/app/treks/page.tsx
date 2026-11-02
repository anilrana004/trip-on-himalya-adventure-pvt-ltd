import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy path — catalogue lives under /journeys. */
export default async function TreksRedirect({ searchParams }: Props) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  Object.entries(sp).forEach(([k, v]) => {
    if (typeof v === "string") params.set(k, v);
  });
  const q = params.toString();
  redirect(`/journeys${q ? `?${q}` : ""}`);
}

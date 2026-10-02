"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { PageLoader, useToast } from "@/components/ui";
import { WeekView } from "@/components/week-view";
import { errMsg } from "@/lib/supabase";
import { loadBundle, type Bundle } from "@/lib/data";

export default function WeekPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Shell title="Pact" back={`/pacts/${id}`}>
      <Suspense fallback={<PageLoader />}>
        <Week id={id} />
      </Suspense>
    </Shell>
  );
}

function Week({ id }: { id: string }) {
  const toast = useToast();
  const sp = useSearchParams();
  const [b, setB] = useState<Bundle | null>(null);

  useEffect(() => {
    loadBundle([id]).then(setB).catch((e) => toast(errMsg(e), "err"));
  }, [id, toast]);

  if (!b) return <PageLoader />;
  return <WeekView b={b} asked={sp.get("w")} />;
}


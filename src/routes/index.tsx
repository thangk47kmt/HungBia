import { createFileRoute } from "@tanstack/react-router";
import { HungBiaApp } from "@/components/hung-bia/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <HungBiaApp />;
}

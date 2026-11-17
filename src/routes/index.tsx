import { createFileRoute } from "@tanstack/react-router";
import { GlobeApp } from "@/globe/GlobeApp";
import "@/globe/globe.css";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <GlobeApp />;
}

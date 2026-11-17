import { createRoot } from "react-dom/client";
import { GlobeApp } from "../globe/GlobeApp";

const root = document.getElementById("root");
if (root) createRoot(root).render(<GlobeApp />);

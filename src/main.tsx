import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initializePwa } from "./lib/pwa";
import "./styles.css";
initializePwa();
createRoot(document.getElementById("root")!).render(<App />);

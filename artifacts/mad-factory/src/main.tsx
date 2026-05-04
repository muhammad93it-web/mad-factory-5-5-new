import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installGlobalNumeralNormalizer } from "./lib/normalize-numerals";

installGlobalNumeralNormalizer();

createRoot(document.getElementById("root")!).render(<App />);

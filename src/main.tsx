import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import { installContextMenuGuard } from "./lib/disableContextMenu";

// Отключаем системное меню по правой кнопке (кроме полей ввода)
installContextMenuGuard();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import { createRoot } from "react-dom/client";

import "./index.css";
import ChatPage from "./pages/ChatPage";

function App() {
  return <ChatPage />;
}

createRoot(document.getElementById("root")).render(<App />);

import { MdRefresh } from "react-icons/md";

import { authenticatedFetch } from "utils/auth/client";

export default function Revalidate() {
  const revalidate = () => {
    authenticatedFetch("/api/revalidate", { method: "POST" }).then((res) => {
      if (res.ok) {
        window.location.reload();
      }
    });
  };

  return (
    <div id="revalidate" className="rounded-full flex align-middle self-center mr-3">
      <MdRefresh onClick={() => revalidate()} className="text-theme-800 dark:text-theme-200 w-6 h-6 cursor-pointer" />
    </div>
  );
}

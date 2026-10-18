"use client";

import { useEffect, useState } from "react";
import { ApiError, getSession, type Session } from "./api";

type State = { status: "loading" } | { status: "signed-in"; session: Session } | { status: "signed-out" };

/** Who is signed in, from /api/auth/me. A 401 means signed out; other errors keep retrying quietly. */
export function useSession(): State {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    getSession()
      .then((session) => alive && setState({ status: "signed-in", session }))
      .catch((err) => {
        if (alive && err instanceof ApiError && err.status === 401) setState({ status: "signed-out" });
        else if (alive) setState({ status: "signed-out" });
      });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

"use client";

import { useRouter } from "next/navigation";
 
type Project = { id: string; title: string };

export function ProjectSwitcher({ projects, activeIdeaId }: { projects: Project[]; activeIdeaId: string }) {
  const router = useRouter();
  const activeIndex = projects.findIndex((p) => p.id === activeIdeaId);
  const active = projects[activeIndex];

  function switchProject(dir: 1 | -1) {
    const nextIndex = (activeIndex + dir + projects.length) % projects.length;
    router.push(`/dashboard?idea=${projects[nextIndex].id}`);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
      {projects.length > 1 && (
        <button onClick={() => switchProject(-1)} className="btn-secondary" style={{ width: 32, height: 32, padding: 0, borderRadius: "50%" }}>
          ←
        </button>
      )}
      <div style={{ textAlign: "center", minWidth: 160 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{active?.title ?? "Projet"}</div>
        {projects.length > 1 && (
          <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 6 }}>
            {projects.map((p) => (
              <div
                key={p.id}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: p.id === activeIdeaId ? "var(--line)" : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>
        )}
      </div>
      {projects.length > 1 && (
        <button onClick={() => switchProject(1)} className="btn-secondary" style={{ width: 32, height: 32, padding: 0, borderRadius: "50%" }}>
          →
        </button>
      )}
    </div>
  );
}

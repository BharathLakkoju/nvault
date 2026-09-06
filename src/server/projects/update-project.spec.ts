import type { Project } from "@/generated/prisma/client";
import { ApiError } from "../http";
import { updateProject } from "./service";

jest.mock("../db", () => ({
  db: {
    project: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("./service", () => {
  const actual = jest.requireActual("./service");
  return {
    ...actual,
    findProjectByGitRemote: jest.fn(),
  };
});

const { db } = jest.requireMock("../db") as {
  db: {
    project: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
};

const { findProjectByGitRemote } = jest.requireMock("./service") as {
  findProjectByGitRemote: jest.Mock;
};

const baseProject = {
  id: "00000000-0000-4000-8000-000000000001",
  ownerId: "user_1",
  organizationId: null,
  name: "app",
  gitRemoteUrl: null,
} as Project;

describe("updateProject git remote linking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findProjectByGitRemote.mockResolvedValue(null);
    db.project.update.mockImplementation(async ({ data }: { data: Partial<Project> }) => ({
      ...baseProject,
      ...data,
    }));
  });

  it("normalizes and stores a git remote URL", async () => {
    const updated = await updateProject("user_1", baseProject, {
      gitRemoteUrl: "https://github.com/BharathLakkoju/nvault.git",
    });
    expect(updated.gitRemoteUrl).toBe("github.com/bharathlakkoju/nvault");
    expect(db.project.update).toHaveBeenCalledWith({
      where: { id: baseProject.id },
      data: { gitRemoteUrl: "github.com/bharathlakkoju/nvault" },
    });
  });

  it("rejects linking a remote already used by another project", async () => {
    findProjectByGitRemote.mockResolvedValue({ id: "other-project" });
    await expect(
      updateProject("user_1", baseProject, {
        gitRemoteUrl: "git@github.com:you/repo.git",
      }),
    ).rejects.toEqual(new ApiError(409, "Another project is already linked to this repository"));
    expect(db.project.update).not.toHaveBeenCalled();
  });
});

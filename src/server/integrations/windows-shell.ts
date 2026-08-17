import { execFile } from "node:child_process";
import { dirname } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface FolderOpener {
  openSkillFolder(skillFilePath: string): Promise<void>;
}

export interface RecycleBin {
  moveSkillToRecycleBin(skillFilePath: string): Promise<void>;
}

export class WindowsFolderOpener implements FolderOpener {
  async openSkillFolder(skillFilePath: string): Promise<void> {
    await execFileAsync("explorer.exe", [dirname(skillFilePath)], { windowsHide: true });
  }
}

export class WindowsRecycleBin implements RecycleBin {
  async moveSkillToRecycleBin(skillFilePath: string): Promise<void> {
    const script = [
      "& { param([string]$target)",
      "Add-Type -AssemblyName Microsoft.VisualBasic;",
      "[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory(",
      "$target,",
      "[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,",
      "[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)",
      "}",
    ].join(" ");
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script, dirname(skillFilePath)],
      { windowsHide: true },
    );
  }
}

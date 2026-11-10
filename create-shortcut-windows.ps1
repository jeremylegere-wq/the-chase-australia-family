$ErrorActionPreference = "Stop"
$gameFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $gameFolder "launch-game-windows.bat"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "The Chase Australia - Family Edition.lnk"
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $gameFolder
$shortcut.Description = "Launch The Chase Australia: Family Edition"
$shortcut.Save()
Write-Host "Desktop shortcut created:"
Write-Host $shortcutPath

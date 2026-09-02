' Video Tagger - Animeko tagging global hotkey tray launcher
' Double-click: starts the tray resident in background with NO window at all.
' Press Ctrl+Alt+T to open the Animeko tagging overlay.
' Exit via tray icon right-click -> Exit. Double-click again just re-focuses the running instance.
Option Explicit
Dim shell, fso, dir, exe, js
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
exe = dir & "\node_modules\electron\dist\electron.exe"
js = dir & "\tag-tray.js"
If Not fso.FileExists(exe) Then
    MsgBox "electron not found at:" & vbCrLf & exe & vbCrLf & vbCrLf & "Run: npm install electron@32.3.3" & vbCrLf & "in folder " & dir & ".", 16, "Video Tagger - Animeko Tag Tray"
    WScript.Quit 1
End If
' Run arg2=0 -> hidden window (no console at all); arg3=False -> don't wait
shell.CurrentDirectory = dir
shell.Run """" & exe & """ """ & js & """", 0, False

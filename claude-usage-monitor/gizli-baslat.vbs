' Sunucuyu konsol penceresi acmadan arka planda baslatir.
' Windows ile birlikte acilmasi icin bu dosyanin kisayolunu su klasore koy:
'   Win+R  ->  shell:startup
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "node """ & dir & "\server.js""", 0, False

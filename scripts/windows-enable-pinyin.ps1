$ErrorActionPreference = 'Stop'

# Microsoft Pinyin's official zh-CN Text Services Framework profile. This
# changes only the disposable GitHub-hosted runner user's language list.
$pinyinTip = '0804:{81D4E9C9-1D3B-41BC-9E6C-4B40BF79E35E}{FA550B04-5AD7-411F-A5AC-CA038EC515D7}'
$languages = New-WinUserLanguageList 'en-US'
$languages.Add('zh-CN')
Set-WinUserLanguageList -LanguageList $languages -Force
Set-WinDefaultInputMethodOverride -InputTip $pinyinTip

$ctfmon = Join-Path $env:SystemRoot 'System32\ctfmon.exe'
Start-Process -FilePath $ctfmon
Start-Sleep -Seconds 2

$configured = Get-WinUserLanguageList
if (-not ($configured.LanguageTag -contains 'zh-CN')) {
  throw 'zh-CN was not added to the current Windows user language list.'
}

Write-Output "MDTXT_WINDOWS_IME configured=microsoft-pinyin inputTip=$pinyinTip"

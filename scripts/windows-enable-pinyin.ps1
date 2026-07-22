$ErrorActionPreference = 'Stop'

# Microsoft Pinyin's official zh-CN Text Services Framework profile. This
# changes only the disposable GitHub-hosted runner user's language list.
$pinyinTip = '0804:{81D4E9C9-1D3B-41BC-9E6C-4B40BF79E35E}{FA550B04-5AD7-411F-A5AC-CA038EC515D7}'
$languages = New-WinUserLanguageList 'en-US'
$languages.Add('zh-CN')
# Adding a language tag does not guarantee that its TSF input profile is
# enabled in the current hosted-runner account. InputMethodTips is the
# read/write source of truth exposed by the International module.
$languages[1].InputMethodTips.Clear()
$languages[1].InputMethodTips.Add($pinyinTip)
Set-WinUserLanguageList -LanguageList $languages -Force
Set-WinDefaultInputMethodOverride -InputTip $pinyinTip

$ctfmon = Join-Path $env:SystemRoot 'System32\ctfmon.exe'
Start-Process -FilePath $ctfmon
Start-Sleep -Seconds 2

$configuredLanguages = Get-WinUserLanguageList
$configured = $configuredLanguages.LanguageTag -join ','
$configuredTips = ($configuredLanguages | ForEach-Object { $_.InputMethodTips }) -join ','
$pinyinBinary = Join-Path $env:SystemRoot 'System32\InputMethod\CHS\ChsIME.exe'
Write-Output "MDTXT_WINDOWS_IME requested=microsoft-pinyin inputTip=$pinyinTip languages=$configured configuredTips=$configuredTips binaryPresent=$(Test-Path $pinyinBinary)"

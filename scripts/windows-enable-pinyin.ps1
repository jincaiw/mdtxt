$ErrorActionPreference = 'Stop'

# Microsoft Pinyin's official zh-CN Text Services Framework profile. This
# changes only the disposable GitHub-hosted runner user's language list.
$pinyinTip = '0804:{81D4E9C9-1D3B-41BC-9E6C-4B40BF79E35E}{FA550B04-5AD7-411F-A5AC-CA038EC515D7}'
$basicCapability = 'Language.Basic~~~zh-CN~0.0.1.0'
$capability = Get-WindowsCapability -Online -Name $basicCapability
if ($capability.State -ne 'Installed') {
  Write-Output "MDTXT_WINDOWS_IME installing=$basicCapability state=$($capability.State)"
  $capability = Add-WindowsCapability -Online -Name $basicCapability
  if ($capability.RestartNeeded) {
    throw "$basicCapability requested a restart on the disposable CI runner."
  }
}

$languages = New-WinUserLanguageList 'en-US'
$languages.Add('zh-CN')
Set-WinUserLanguageList -LanguageList $languages -Force
Set-WinDefaultInputMethodOverride -InputTip $pinyinTip

$ctfmon = Join-Path $env:SystemRoot 'System32\ctfmon.exe'
Start-Process -FilePath $ctfmon
Start-Sleep -Seconds 2

$configured = $null
for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
  $configured = Get-WinUserLanguageList
  if ($configured.LanguageTag -contains 'zh-CN') {
    break
  }
  Start-Sleep -Milliseconds 250
}
if (-not ($configured.LanguageTag -contains 'zh-CN')) {
  throw 'zh-CN was not added to the current Windows user language list.'
}

Write-Output "MDTXT_WINDOWS_IME configured=microsoft-pinyin inputTip=$pinyinTip"

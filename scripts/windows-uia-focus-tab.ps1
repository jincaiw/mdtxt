param(
  [Parameter(Mandatory = $true)]
  [int]$TargetProcessId,

  [Parameter(Mandatory = $true)]
  [int]$Index,

  [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
while ([DateTime]::UtcNow -lt $deadline) {
  $process = Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue
  if ($null -ne $process -and $process.MainWindowHandle -ne [IntPtr]::Zero) {
    try {
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
      $condition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::TabItem
      )
      $tabs = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
      if ($tabs.Count -gt $Index) {
        $tab = $tabs.Item($Index)
        $invoke = $null
        if ($tab.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$invoke)) {
          $invoke.Invoke()
          Write-Output "MDTXT_UIA_SELECT_TAB index=$Index count=$($tabs.Count) name=$($tab.Current.Name) method=invoke"
          exit 0
        }
        $legacy = $null
        if ($tab.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$legacy)) {
          $legacy.DoDefaultAction()
          Write-Output "MDTXT_UIA_SELECT_TAB index=$Index count=$($tabs.Count) name=$($tab.Current.Name) method=legacy"
          exit 0
        }
        $selection = $null
        if ($tab.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$selection)) {
          $selection.Select()
          Write-Output "MDTXT_UIA_SELECT_TAB index=$Index count=$($tabs.Count) name=$($tab.Current.Name) method=selection-item"
          exit 0
        }
        # WebView2 does not consistently expose an invokable pattern for an
        # ARIA tab. Keep focus and activation in this process so another
        # SendInput process cannot move focus back to the top-level window.
        $tab.SetFocus()
        Start-Sleep -Milliseconds 100
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Write-Output "MDTXT_UIA_SELECT_TAB index=$Index count=$($tabs.Count) name=$($tab.Current.Name) method=focus-enter"
        exit 0
      }
    } catch {
      # React/WebView2 may replace the accessibility node while recovery mounts.
    }
  }
  Start-Sleep -Milliseconds 200
}

throw "Timed out waiting to select tab index $Index."

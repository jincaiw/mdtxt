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
        # WebView2 does not consistently expose an invokable pattern for an
        # ARIA tab, and probing unsupported patterns can itself throw. Keep
        # discovery, focus and activation in one process so no helper can move
        # focus back to the top-level window between SetFocus and Enter.
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

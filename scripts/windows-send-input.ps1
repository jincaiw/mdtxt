param(
  [Parameter(Mandatory = $true)]
  [int]$TargetProcessId,

  [string]$Text = '',

  [int]$DelayMilliseconds = 10,

  [switch]$MoveToEnd,

  [ValidateSet('Space', 'Enter', 'Left', 'Right', 'Up', 'Down', 'ControlN', 'ControlZ', 'ControlY', 'ControlShiftZ', 'ControlShiftTab', 'ControlA', 'ControlC', 'ControlV', 'WinSpace', 'ActivateChinese')]
  [string[]]$Keys = @()
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class MdtxtNativeInput
{
    private const uint INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const int SW_RESTORE = 9;
    private const ushort VK_CONTROL = 0x11;
    private const ushort VK_SHIFT = 0x10;
    private const ushort VK_LWIN = 0x5B;
    private const ushort VK_SPACE = 0x20;
    private const ushort VK_RETURN = 0x0D;
    private const ushort VK_LEFT = 0x25;
    private const ushort VK_UP = 0x26;
    private const ushort VK_RIGHT = 0x27;
    private const ushort VK_DOWN = 0x28;
    private const ushort VK_END = 0x23;
    private const ushort VK_TAB = 0x09;
    private const uint KLF_ACTIVATE = 0x00000001;
    private const uint KLF_SUBSTITUTE_OK = 0x00000002;
    private const uint WM_INPUTLANGCHANGEREQUEST = 0x0050;

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT
    {
        public uint type;
        public INPUTUNION data;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct INPUTUNION
    {
        [FieldOffset(0)]
        public MOUSEINPUT mouse;

        [FieldOffset(0)]
        public KEYBDINPUT keyboard;

        [FieldOffset(0)]
        public HARDWAREINPUT hardware;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT
    {
        public int x;
        public int y;
        public uint mouseData;
        public uint flags;
        public uint time;
        public UIntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT
    {
        public ushort virtualKey;
        public ushort scanCode;
        public uint flags;
        public uint time;
        public UIntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct HARDWAREINPUT
    {
        public uint message;
        public ushort parameterLow;
        public ushort parameterHigh;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int left;
        public int top;
        public int right;
        public int bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct GUITHREADINFO
    {
        public uint size;
        public uint flags;
        public IntPtr active;
        public IntPtr focus;
        public IntPtr capture;
        public IntPtr menuOwner;
        public IntPtr moveSize;
        public IntPtr caret;
        public RECT caretRect;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint count, INPUT[] inputs, int size);

    [DllImport("user32.dll")]
    private static extern short VkKeyScanW(char character);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr window);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr window, int command);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool GetGUIThreadInfo(uint threadId, ref GUITHREADINFO info);

    [DllImport("user32.dll")]
    private static extern IntPtr GetKeyboardLayout(uint threadId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr LoadKeyboardLayout(string layoutId, uint flags);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);

    public static void Focus(IntPtr window)
    {
        ShowWindow(window, SW_RESTORE);
        if (!SetForegroundWindow(window))
        {
            throw new InvalidOperationException("SetForegroundWindow rejected the mdtxt window.");
        }
    }

    public static void SendCharacter(char character)
    {
        short mapping = VkKeyScanW(character);
        if (mapping == -1)
        {
            throw new InvalidOperationException(
                String.Format("No virtual-key mapping for U+{0:X4}.", (int)character)
            );
        }

        ushort virtualKey = (ushort)(mapping & 0xff);
        byte modifiers = (byte)((mapping >> 8) & 0xff);
        if (modifiers != 0)
        {
            throw new InvalidOperationException(
                String.Format(
                    "The native smoke only accepts unmodified characters; '{0}' requires modifier mask {1}.",
                    character,
                    modifiers
                )
            );
        }

        var inputs = new INPUT[]
        {
            new INPUT
            {
                type = INPUT_KEYBOARD,
                data = new INPUTUNION
                {
                    keyboard = new KEYBDINPUT { virtualKey = virtualKey }
                }
            },
            new INPUT
            {
                type = INPUT_KEYBOARD,
                data = new INPUTUNION
                {
                    keyboard = new KEYBDINPUT { virtualKey = virtualKey, flags = KEYEVENTF_KEYUP }
                }
            }
        };

        uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>());
        if (sent != inputs.Length)
        {
            throw new InvalidOperationException(
                String.Format(
                    "SendInput delivered {0} of {1} keyboard records. Win32={2}.",
                    sent,
                    inputs.Length,
                    Marshal.GetLastWin32Error()
                )
            );
        }
    }

    public static void SendChord(ushort[] keys)
    {
        var inputs = new INPUT[keys.Length * 2];
        for (int index = 0; index < keys.Length; index++)
        {
            inputs[index] = new INPUT
            {
                type = INPUT_KEYBOARD,
                data = new INPUTUNION
                {
                    keyboard = new KEYBDINPUT { virtualKey = keys[index] }
                }
            };
            inputs[keys.Length + index] = new INPUT
            {
                type = INPUT_KEYBOARD,
                data = new INPUTUNION
                {
                    keyboard = new KEYBDINPUT
                    {
                        virtualKey = keys[keys.Length - index - 1],
                        flags = KEYEVENTF_KEYUP
                    }
                }
            };
        }

        uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>());
        if (sent != inputs.Length)
        {
            throw new InvalidOperationException(
                String.Format(
                    "SendInput delivered {0} of {1} chord records. Win32={2}.",
                    sent,
                    inputs.Length,
                    Marshal.GetLastWin32Error()
                )
            );
        }
    }

    public static void SendControlEnd()
    {
        SendChord(new ushort[] { VK_CONTROL, VK_END });
    }

    public static void SendNamedKey(string name)
    {
        switch (name)
        {
            case "Space": SendChord(new ushort[] { VK_SPACE }); break;
            case "Enter": SendChord(new ushort[] { VK_RETURN }); break;
            case "Left": SendChord(new ushort[] { VK_LEFT }); break;
            case "Right": SendChord(new ushort[] { VK_RIGHT }); break;
            case "Up": SendChord(new ushort[] { VK_UP }); break;
            case "Down": SendChord(new ushort[] { VK_DOWN }); break;
            case "ControlN": SendChord(new ushort[] { VK_CONTROL, 0x4E }); break;
            case "ControlZ": SendChord(new ushort[] { VK_CONTROL, 0x5A }); break;
            case "ControlY": SendChord(new ushort[] { VK_CONTROL, 0x59 }); break;
            case "ControlShiftZ": SendChord(new ushort[] { VK_CONTROL, VK_SHIFT, 0x5A }); break;
            case "ControlShiftTab": SendChord(new ushort[] { VK_CONTROL, VK_SHIFT, VK_TAB }); break;
            case "ControlA": SendChord(new ushort[] { VK_CONTROL, 0x41 }); break;
            case "ControlC": SendChord(new ushort[] { VK_CONTROL, 0x43 }); break;
            case "ControlV": SendChord(new ushort[] { VK_CONTROL, 0x56 }); break;
            case "WinSpace": SendChord(new ushort[] { VK_LWIN, VK_SPACE }); break;
            default: throw new InvalidOperationException("Unknown named key: " + name);
        }
    }

    public static void ActivateChinese(IntPtr window)
    {
        IntPtr layout = LoadKeyboardLayout("00000804", KLF_ACTIVATE | KLF_SUBSTITUTE_OK);
        if (layout == IntPtr.Zero)
        {
            throw new InvalidOperationException(
                "LoadKeyboardLayout(00000804) failed. Win32=" + Marshal.GetLastWin32Error()
            );
        }
        IntPtr inputWindow = GetInputWindow(window);
        if (!PostMessage(inputWindow, WM_INPUTLANGCHANGEREQUEST, IntPtr.Zero, layout))
        {
            throw new InvalidOperationException(
                "WM_INPUTLANGCHANGEREQUEST failed. Win32=" + Marshal.GetLastWin32Error()
            );
        }
    }

    private static IntPtr GetInputWindow(IntPtr fallback)
    {
        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero) foreground = fallback;
        uint processId;
        uint threadId = GetWindowThreadProcessId(foreground, out processId);
        var info = new GUITHREADINFO { size = (uint)Marshal.SizeOf<GUITHREADINFO>() };
        if (threadId != 0 && GetGUIThreadInfo(threadId, ref info) && info.focus != IntPtr.Zero)
        {
            return info.focus;
        }
        return foreground;
    }

    public static ushort GetLanguageId(IntPtr window)
    {
        window = GetInputWindow(window);
        uint processId;
        uint threadId = GetWindowThreadProcessId(window, out processId);
        long layout = GetKeyboardLayout(threadId).ToInt64();
        return (ushort)(layout & 0xffff);
    }
}
'@

$process = Get-Process -Id $TargetProcessId
if ($process.MainWindowHandle -eq [IntPtr]::Zero) {
  throw "mdtxt process $TargetProcessId has no main window."
}

[MdtxtNativeInput]::Focus($process.MainWindowHandle)
Start-Sleep -Milliseconds 250
if ($MoveToEnd) {
  [MdtxtNativeInput]::SendControlEnd()
  Start-Sleep -Milliseconds 100
}

foreach ($character in $Text.ToCharArray()) {
  [MdtxtNativeInput]::SendCharacter($character)
  if ($DelayMilliseconds -gt 0) {
    Start-Sleep -Milliseconds $DelayMilliseconds
  }
}

foreach ($key in $Keys) {
  if ($key -eq 'ActivateChinese') {
    [MdtxtNativeInput]::ActivateChinese($process.MainWindowHandle)
  } else {
    [MdtxtNativeInput]::SendNamedKey($key)
  }
  if ($DelayMilliseconds -gt 0) {
    Start-Sleep -Milliseconds $DelayMilliseconds
  }
}

$languageId = [MdtxtNativeInput]::GetLanguageId($process.MainWindowHandle)
Write-Output ('MDTXT_NATIVE_INPUT languageId=0x{0:X4}' -f $languageId)

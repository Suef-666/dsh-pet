# Generate dsh-pet plugin logo.png (512x512, rounded blue bg + white whale + "dsh" wordmark)
# Requires Windows GDI+ (System.Drawing)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$size = 512
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.Color]::Transparent)

function RoundedRect($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# background: rounded square + vertical gradient
$bgRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $bgRect,
  [System.Drawing.Color]::FromArgb(255, 59, 130, 246),
  [System.Drawing.Color]::FromArgb(255, 29, 78, 216),
  90)
$bg = RoundedRect 24 24 464 464 110
$g.FillPath($grad, $bg)

# whale (white, facing left)
$cWhale = [System.Drawing.Color]::FromArgb(255, 248, 250, 252)
$cBelly = [System.Drawing.Color]::FromArgb(120, 191, 219, 254)
$cEye   = [System.Drawing.Color]::FromArgb(255, 30, 41, 59)
$cSpout = [System.Drawing.Color]::FromArgb(255, 191, 219, 254)

$bWhale = [System.Drawing.SolidBrush]::new($cWhale)
$bBelly = [System.Drawing.SolidBrush]::new($cBelly)
$bEye   = [System.Drawing.SolidBrush]::new($cEye)
$bSpout = [System.Drawing.SolidBrush]::new($cSpout)

# body
$g.FillEllipse($bWhale, 140, 220, 260, 130)
# head
$g.FillEllipse($bWhale, 105, 205, 170, 165)
# tail flukes
$topFluke = [System.Drawing.PointF[]]@(
  (New-Object System.Drawing.PointF(395, 245)),
  (New-Object System.Drawing.PointF(455, 170)),
  (New-Object System.Drawing.PointF(495, 195)),
  (New-Object System.Drawing.PointF(465, 270)))
$g.FillPolygon($bWhale, $topFluke)
$botFluke = [System.Drawing.PointF[]]@(
  (New-Object System.Drawing.PointF(395, 325)),
  (New-Object System.Drawing.PointF(455, 400)),
  (New-Object System.Drawing.PointF(495, 375)),
  (New-Object System.Drawing.PointF(465, 300)))
$g.FillPolygon($bWhale, $botFluke)
# belly
$g.FillEllipse($bBelly, 205, 300, 165, 62)
# eye
$g.FillEllipse($bEye, 148, 252, 24, 24)
# water spout (three dots)
$g.FillEllipse($bSpout, 168, 150, 26, 26)
$g.FillEllipse($bSpout, 214, 128, 24, 24)
$g.FillEllipse($bSpout, 250, 142, 20, 20)

# wordmark "dsh"
$font = New-Object System.Drawing.Font("Segoe UI", 52, [System.Drawing.FontStyle]::Bold)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("dsh", $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(0, 408, $size, 56)), $sf)

$g.Dispose()
$bmp.Save((Join-Path $PSScriptRoot "logo.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host ("logo.png written (512x512): " + (Get-Item (Join-Path $PSScriptRoot "logo.png")).Length + " bytes")

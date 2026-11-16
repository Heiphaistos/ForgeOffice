param([string]$path)
[Console]::OutputEncoding=[Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]
$null=[Windows.Storage.StorageFile,Windows.Foundation,ContentType=WindowsRuntime]
function Await($t,$rt){ $m=[System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'}|select -first 1; $x=$m.MakeGenericMethod($rt).Invoke($null,@($t)); $x.Wait(-1)|Out-Null; $x.Result }
$e=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
foreach($p in $args + @($path)){ if(-not $p){continue}
 $f=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($p)) ([Windows.Storage.StorageFile])
 $s=Await ($f.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
 $d=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($s)) ([Windows.Graphics.Imaging.BitmapDecoder])
 $bmp=Await ($d.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
 $r=Await ($e.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
 foreach($l in $r.Lines){ $w=@($l.Words); $b=$w[0].BoundingRect; $lw=$w[$w.Count-1].BoundingRect; $y=[int]($b.Y+$b.Height/2); $x=[int]$b.X; $xe=[int]($lw.X+$lw.Width); "$p`t$y`t$x`t$xe`t$($l.Text)" }
}

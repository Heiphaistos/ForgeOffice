# Verification dans Excel 365 (COM, masque) : ouvre un classeur, liste ses tableaux croises (champs, fonctions, plage) et,
# avec -Refresh, les rafraichit et affiche le resultat. Excel est toujours ferme dans le bloc finally.
# Usage : powershell -NoProfile -File verifier-tcd-excel.ps1 -Path "C:\chemin\classeur.xlsx" -Refresh
param([string]$Path,[switch]$Refresh)
$ErrorActionPreference='Stop'
$xl = New-Object -ComObject Excel.Application
try {
  $xl.Visible=$false; $xl.DisplayAlerts=$false
  $wb=$xl.Workbooks.Open($Path)
  foreach($ws in $wb.Worksheets){
    $n=$ws.PivotTables().Count
    "FEUILLE " + $ws.Name + " tableaux croises=" + $n
    for($i=1;$i -le $n;$i++){
      $pt=$ws.PivotTables($i)
      $rows=@(); for($k=1;$k -le $pt.RowFields().Count;$k++){ $rows += $pt.RowFields($k).Name }
      $cols=@(); for($k=1;$k -le $pt.ColumnFields().Count;$k++){ $cols += $pt.ColumnFields($k).Name }
      $data=@(); for($k=1;$k -le $pt.DataFields().Count;$k++){ $d=$pt.DataFields($k); $data += ($d.Name + ':' + $d.Function) }
      $pages=@(); for($k=1;$k -le $pt.PageFields().Count;$k++){ $pages += $pt.PageFields($k).Name }
      "  TCD " + $pt.Name + " source=" + $pt.SourceData + " lignes=[" + ($rows -join ',') + "] colonnes=[" + ($cols -join ',') + "] donnees=[" + ($data -join ',') + "] filtres=[" + ($pages -join ',') + "] plage=" + $pt.TableRange1.Address($false,$false)
      if($Refresh){
        [void]$pt.RefreshTable()
        "     apres actualisation plage=" + $pt.TableRange1.Address($false,$false)
        $r=$pt.TableRange1
        for($y=1;$y -le $r.Rows.Count;$y++){ $line=@(); for($x=1;$x -le $r.Columns.Count;$x++){ $line += $r.Cells.Item($y,$x).Text }; "     | " + ($line -join ' | ') }
      }
    }
  }
  $wb.Close($false)
} finally { $xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl) }

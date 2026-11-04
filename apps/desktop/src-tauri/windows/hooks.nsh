; GENERE par scripts/associations.mjs : ne pas modifier a la main.

!macro FO_PRE EXT
  ReadRegStr $R0 SHCTX "Software\Classes\.${EXT}" ""
  ${If} $R0 == "ForgeOffice.${EXT}"
    ReadRegStr $R1 SHCTX "Software\Classes\.${EXT}" "ForgeOffice.${EXT}_backup"
    ${If} $R1 == ""
      DeleteRegValue SHCTX "Software\Classes\.${EXT}" ""
    ${Else}
      WriteRegStr SHCTX "Software\Classes\.${EXT}" "" $R1
    ${EndIf}
  ${EndIf}
!macroend

!macro FO_POST EXT GENERIC
  WriteRegStr SHCTX "Software\Classes\ForgeOffice.${EXT}\shell\open" "" "Ouvrir avec ForgeOffice"
  WriteRegStr SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "ForgeOffice.${EXT}" ""
  !if ${GENERIC} == 1
    !insertmacro FO_PRE ${EXT}
  !endif
!macroend

!macro FO_UN EXT
  DeleteRegValue SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "ForgeOffice.${EXT}"
  DeleteRegKey /ifempty SHCTX "Software\Classes\.${EXT}\OpenWithProgids"
  ReadRegStr $R0 SHCTX "Software\Classes\.${EXT}" ""
  ${If} $R0 == ""
  ${OrIf} $R0 == "ForgeOffice.${EXT}"
    DeleteRegValue SHCTX "Software\Classes\.${EXT}" ""
  ${EndIf}
  DeleteRegValue SHCTX "Software\Classes\.${EXT}" "ForgeOffice.${EXT}_backup"
  DeleteRegKey /ifempty SHCTX "Software\Classes\.${EXT}"
!macroend

; Desinstallation complete (pas une mise a jour) : oublie le dossier d'installation, sinon un .msi installe
; ensuite le reprendrait (recherche PrevInstallDirNoName du modele WiX : .msi par machine dans AppData).
!macro FO_FORGET_INSTDIR
  ${If} $UpdateMode <> 1
    DeleteRegValue SHCTX "${MANUPRODUCTKEY}" ""
    DeleteRegKey /ifempty SHCTX "${MANUPRODUCTKEY}"
  ${EndIf}
!macroend

!macro FO_NOTIFY
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro FO_PRE docx
  !insertmacro FO_PRE docm
  !insertmacro FO_PRE dotx
  !insertmacro FO_PRE doc
  !insertmacro FO_PRE odt
  !insertmacro FO_PRE rtf
  !insertmacro FO_PRE html
  !insertmacro FO_PRE htm
  !insertmacro FO_PRE xlsx
  !insertmacro FO_PRE xlsm
  !insertmacro FO_PRE xltx
  !insertmacro FO_PRE xls
  !insertmacro FO_PRE ods
  !insertmacro FO_PRE csv
  !insertmacro FO_PRE tsv
  !insertmacro FO_PRE pptx
  !insertmacro FO_PRE pptm
  !insertmacro FO_PRE potx
  !insertmacro FO_PRE ppsx
  !insertmacro FO_PRE ppt
  !insertmacro FO_PRE odp
  !insertmacro FO_PRE fopub
  !insertmacro FO_PRE pub
  !insertmacro FO_PRE fodb
  !insertmacro FO_PRE sqlite
  !insertmacro FO_PRE db
  !insertmacro FO_PRE accdb
  !insertmacro FO_PRE mdb
  !insertmacro FO_PRE pdf
  !insertmacro FO_PRE txt
  !insertmacro FO_PRE md
  !insertmacro FO_PRE markdown
  !insertmacro FO_PRE log
  !insertmacro FO_PRE ini
  !insertmacro FO_PRE cfg
  !insertmacro FO_PRE conf
  !insertmacro FO_PRE json
  !insertmacro FO_PRE xml
  !insertmacro FO_PRE yaml
  !insertmacro FO_PRE yml
  !insertmacro FO_PRE toml
  !insertmacro FO_PRE tsx
  !insertmacro FO_PRE jsx
  !insertmacro FO_PRE rs
  !insertmacro FO_PRE c
  !insertmacro FO_PRE h
  !insertmacro FO_PRE cpp
  !insertmacro FO_PRE hpp
  !insertmacro FO_PRE cs
  !insertmacro FO_PRE java
  !insertmacro FO_PRE go
  !insertmacro FO_PRE php
  !insertmacro FO_PRE rb
  !insertmacro FO_PRE css
  !insertmacro FO_PRE scss
  !insertmacro FO_PRE sql
  !insertmacro FO_PRE lua
  !insertmacro FO_PRE kt
  !insertmacro FO_PRE swift
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro FO_POST docx 0
  !insertmacro FO_POST docm 0
  !insertmacro FO_POST dotx 0
  !insertmacro FO_POST doc 0
  !insertmacro FO_POST odt 0
  !insertmacro FO_POST rtf 0
  !insertmacro FO_POST html 1
  !insertmacro FO_POST htm 1
  !insertmacro FO_POST xlsx 0
  !insertmacro FO_POST xlsm 0
  !insertmacro FO_POST xltx 0
  !insertmacro FO_POST xls 0
  !insertmacro FO_POST ods 0
  !insertmacro FO_POST csv 1
  !insertmacro FO_POST tsv 1
  !insertmacro FO_POST pptx 0
  !insertmacro FO_POST pptm 0
  !insertmacro FO_POST potx 0
  !insertmacro FO_POST ppsx 0
  !insertmacro FO_POST ppt 0
  !insertmacro FO_POST odp 0
  !insertmacro FO_POST fopub 0
  !insertmacro FO_POST pub 0
  !insertmacro FO_POST fodb 0
  !insertmacro FO_POST sqlite 1
  !insertmacro FO_POST db 1
  !insertmacro FO_POST accdb 0
  !insertmacro FO_POST mdb 0
  !insertmacro FO_POST pdf 0
  !insertmacro FO_POST txt 1
  !insertmacro FO_POST md 1
  !insertmacro FO_POST markdown 1
  !insertmacro FO_POST log 1
  !insertmacro FO_POST ini 1
  !insertmacro FO_POST cfg 1
  !insertmacro FO_POST conf 1
  !insertmacro FO_POST json 1
  !insertmacro FO_POST xml 1
  !insertmacro FO_POST yaml 1
  !insertmacro FO_POST yml 1
  !insertmacro FO_POST toml 1
  !insertmacro FO_POST tsx 1
  !insertmacro FO_POST jsx 1
  !insertmacro FO_POST rs 1
  !insertmacro FO_POST c 1
  !insertmacro FO_POST h 1
  !insertmacro FO_POST cpp 1
  !insertmacro FO_POST hpp 1
  !insertmacro FO_POST cs 1
  !insertmacro FO_POST java 1
  !insertmacro FO_POST go 1
  !insertmacro FO_POST php 1
  !insertmacro FO_POST rb 1
  !insertmacro FO_POST css 1
  !insertmacro FO_POST scss 1
  !insertmacro FO_POST sql 1
  !insertmacro FO_POST lua 1
  !insertmacro FO_POST kt 1
  !insertmacro FO_POST swift 1
  !insertmacro FO_NOTIFY
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro FO_UN docx
  !insertmacro FO_UN docm
  !insertmacro FO_UN dotx
  !insertmacro FO_UN doc
  !insertmacro FO_UN odt
  !insertmacro FO_UN rtf
  !insertmacro FO_UN html
  !insertmacro FO_UN htm
  !insertmacro FO_UN xlsx
  !insertmacro FO_UN xlsm
  !insertmacro FO_UN xltx
  !insertmacro FO_UN xls
  !insertmacro FO_UN ods
  !insertmacro FO_UN csv
  !insertmacro FO_UN tsv
  !insertmacro FO_UN pptx
  !insertmacro FO_UN pptm
  !insertmacro FO_UN potx
  !insertmacro FO_UN ppsx
  !insertmacro FO_UN ppt
  !insertmacro FO_UN odp
  !insertmacro FO_UN fopub
  !insertmacro FO_UN pub
  !insertmacro FO_UN fodb
  !insertmacro FO_UN sqlite
  !insertmacro FO_UN db
  !insertmacro FO_UN accdb
  !insertmacro FO_UN mdb
  !insertmacro FO_UN pdf
  !insertmacro FO_UN txt
  !insertmacro FO_UN md
  !insertmacro FO_UN markdown
  !insertmacro FO_UN log
  !insertmacro FO_UN ini
  !insertmacro FO_UN cfg
  !insertmacro FO_UN conf
  !insertmacro FO_UN json
  !insertmacro FO_UN xml
  !insertmacro FO_UN yaml
  !insertmacro FO_UN yml
  !insertmacro FO_UN toml
  !insertmacro FO_UN tsx
  !insertmacro FO_UN jsx
  !insertmacro FO_UN rs
  !insertmacro FO_UN c
  !insertmacro FO_UN h
  !insertmacro FO_UN cpp
  !insertmacro FO_UN hpp
  !insertmacro FO_UN cs
  !insertmacro FO_UN java
  !insertmacro FO_UN go
  !insertmacro FO_UN php
  !insertmacro FO_UN rb
  !insertmacro FO_UN css
  !insertmacro FO_UN scss
  !insertmacro FO_UN sql
  !insertmacro FO_UN lua
  !insertmacro FO_UN kt
  !insertmacro FO_UN swift
  !insertmacro FO_FORGET_INSTDIR
  !insertmacro FO_NOTIFY
!macroend

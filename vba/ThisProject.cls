VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "ThisProject"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
'==============================================================================
' ThisProject — MS Project ↔ Excel progress sync
'
' Tailored for schedules like Arvin's Sappi Saiccor Woodyard Stormwater
' programme (deep WBS, many summary rows, duplicate leaf names such as
' "Rebar" / "Concrete" under different headwalls). UniqueID is the only
' safe join key — never match by Task Name alone.
'
' Export task progress to Excel for editing, then import % Complete (and
' optional Task Name changes) back into the open Project file.
'
' Late-bound Excel.Application — no Excel library reference required.
' (Early-bound alternative: Tools > References > Microsoft Excel Object Library)
'
' Note: This VBA must be run inside Microsoft Project on Windows. It was not
' executed against the .mpp on Linux.
'==============================================================================

Option Explicit

'--- Config -------------------------------------------------------------------
' Default workbook path (USERPROFILE resolved at runtime).
' Override via InputBox when exporting / when the file is missing on import.
Private Const PROGRESS_SHEET_NAME As String = "Progress"

' Column layout (1-based). UniqueID is the join key — do not remove.
Private Const COL_UNIQUE_ID As Long = 1
Private Const COL_TASK_NAME As Long = 2
Private Const COL_WBS As Long = 3
Private Const COL_OUTLINE As Long = 4
Private Const COL_START As Long = 5
Private Const COL_FINISH As Long = 6
Private Const COL_PCT As Long = 7
Private Const COL_SUMMARY As Long = 8   ' Y/N — visible guide; % Complete locked when Y

Private Const HEADER_ROW As Long = 1
Private Const FIRST_DATA_ROW As Long = 2

'------------------------------------------------------------------------------
' Public entry points
'------------------------------------------------------------------------------

Public Sub ExportProgressToExcel()
    On Error GoTo Fail

    Dim excelPath As String
    Dim xlApp As Object
    Dim xlBook As Object
    Dim xlSheet As Object
    Dim t As Task
    Dim row As Long
    Dim taskCount As Long
    Dim leafCount As Long
    Dim summaryCount As Long
    Dim errNum As Long
    Dim errDesc As String

    If ActiveProject Is Nothing Then
        MsgBox "No project is open.", vbExclamation, "Export Progress"
        Exit Sub
    End If

    taskCount = 0
    leafCount = 0
    summaryCount = 0
    For Each t In ActiveProject.Tasks
        If Not t Is Nothing Then
            taskCount = taskCount + 1
            If t.Summary Then
                summaryCount = summaryCount + 1
            Else
                leafCount = leafCount + 1
            End If
        End If
    Next t

    If taskCount = 0 Then
        MsgBox "This project has no tasks to export.", vbExclamation, "Export Progress"
        Exit Sub
    End If

    excelPath = ResolveExcelPath(False)
    If Len(excelPath) = 0 Then Exit Sub

    Set xlApp = CreateExcelApp()
    If xlApp Is Nothing Then Exit Sub

    Application.StatusBar = "Exporting " & CStr(taskCount) & " tasks to Excel..."

    xlApp.DisplayAlerts = False
    Set xlBook = xlApp.Workbooks.Add
    Set xlSheet = xlBook.Worksheets(1)
    xlSheet.Name = PROGRESS_SHEET_NAME

    WriteHeaderRow xlSheet

    row = FIRST_DATA_ROW
    For Each t In ActiveProject.Tasks
        If Not t Is Nothing Then
            xlSheet.Cells(row, COL_UNIQUE_ID).Value = t.UniqueID
            ' Indent name by outline level so deep WBS (levels 0–7+) stays readable.
            xlSheet.Cells(row, COL_TASK_NAME).Value = t.Name
            xlSheet.Cells(row, COL_TASK_NAME).IndentLevel = _
                IIf(t.OutlineLevel > 15, 15, t.OutlineLevel)
            xlSheet.Cells(row, COL_WBS).Value = t.WBS
            xlSheet.Cells(row, COL_OUTLINE).Value = t.OutlineLevel
            xlSheet.Cells(row, COL_START).Value = t.Start
            xlSheet.Cells(row, COL_FINISH).Value = t.Finish
            xlSheet.Cells(row, COL_PCT).Value = t.PercentComplete
            xlSheet.Cells(row, COL_SUMMARY).Value = IIf(t.Summary, "Y", "N")
            row = row + 1
        End If
    Next t

    FormatProgressSheet xlSheet, row - 1

    EnsureParentFolder excelPath
    xlBook.SaveAs excelPath
    xlBook.Close SaveChanges:=False
    xlApp.Quit

    Set xlSheet = Nothing
    Set xlBook = Nothing
    Set xlApp = Nothing
    Application.StatusBar = False

    MsgBox "Exported " & CStr(taskCount) & " task(s) to:" & vbCrLf & excelPath & vbCrLf & vbCrLf & _
           "Leaf tasks (edit % Complete): " & CStr(leafCount) & vbCrLf & _
           "Summary tasks (rolled up — % locked): " & CStr(summaryCount) & vbCrLf & vbCrLf & _
           "Edit % Complete on leaf rows only, then run ImportProgressFromExcel." & vbCrLf & _
           "Keep UniqueID intact (hidden column A) — names alone are not unique.", _
           vbInformation, "Export Progress"
    Exit Sub

Fail:
    ' Capture before CleanupExcel — its On Error Resume Next clears Err.
    errNum = Err.Number
    errDesc = Err.Description
    Application.StatusBar = False
    CleanupExcel xlApp, xlBook
    MsgBox "Export failed:" & vbCrLf & errDesc & _
           IIf(errNum <> 0, " (Error " & CStr(errNum) & ")", ""), _
           vbCritical, "Export Progress"
End Sub

Public Sub ImportProgressFromExcel()
    On Error GoTo Fail

    Dim excelPath As String
    Dim xlApp As Object
    Dim xlBook As Object
    Dim xlSheet As Object
    Dim lastRow As Long
    Dim row As Long
    Dim uid As Long
    Dim t As Task
    Dim newPct As Double
    Dim excelName As String
    Dim updated As Long
    Dim skippedSummary As Long
    Dim missing As Long
    Dim nameChanges As Long
    Dim unchanged As Long
    Dim rawUid As Variant
    Dim rawPct As Variant
    Dim errNum As Long
    Dim errDesc As String

    If ActiveProject Is Nothing Then
        MsgBox "No project is open.", vbExclamation, "Import Progress"
        Exit Sub
    End If

    excelPath = ResolveExcelPath(True)
    If Len(excelPath) = 0 Then Exit Sub

    If Dir(excelPath) = "" Then
        MsgBox "Excel file not found:" & vbCrLf & excelPath, vbExclamation, "Import Progress"
        Exit Sub
    End If

    Set xlApp = CreateExcelApp()
    If xlApp Is Nothing Then Exit Sub

    Application.StatusBar = "Importing progress from Excel..."

    xlApp.DisplayAlerts = False
    Set xlBook = xlApp.Workbooks.Open(excelPath, ReadOnly:=True)

    On Error Resume Next
    Set xlSheet = xlBook.Worksheets(PROGRESS_SHEET_NAME)
    On Error GoTo Fail

    If xlSheet Is Nothing Then
        xlBook.Close SaveChanges:=False
        xlApp.Quit
        Application.StatusBar = False
        MsgBox "Sheet '" & PROGRESS_SHEET_NAME & "' was not found in:" & vbCrLf & excelPath, _
               vbExclamation, "Import Progress"
        Exit Sub
    End If

    lastRow = xlSheet.Cells(xlSheet.Rows.Count, COL_UNIQUE_ID).End(-4162).row ' xlUp
    If lastRow < FIRST_DATA_ROW Then
        xlBook.Close SaveChanges:=False
        xlApp.Quit
        Application.StatusBar = False
        MsgBox "No task rows found on sheet '" & PROGRESS_SHEET_NAME & "'.", _
               vbExclamation, "Import Progress"
        Exit Sub
    End If

    ' Leaf-only % Complete: Project rejects PercentComplete writes on summary
    ' tasks (they roll up from children). On schedules like the Sappi stormwater
    ' programme (~80 summaries / ~177 leaves), we skip summaries for % Complete
    ' but still allow Task Name updates on any matched UniqueID. New tasks are
    ' never created — unmatched UniqueIDs are counted as missing.
    updated = 0
    skippedSummary = 0
    missing = 0
    nameChanges = 0
    unchanged = 0

    For row = FIRST_DATA_ROW To lastRow
        rawUid = xlSheet.Cells(row, COL_UNIQUE_ID).Value
        If IsBlank(rawUid) Then GoTo NextRow
        If Not IsNumeric(rawUid) Then GoTo NextRow

        uid = CLng(rawUid)
        Set t = FindTaskByUniqueID(uid)
        If t Is Nothing Then
            missing = missing + 1
            GoTo NextRow
        End If

        ' Optional Task Name sync (never invents new tasks).
        ' Compare Trim of both sides so trailing/leading spaces already on the
        ' Project name (common in this programme) are not rewritten solely
        ' because Excel/import trimmed them. Only rename on a real content edit.
        excelName = CStr(xlSheet.Cells(row, COL_TASK_NAME).Value & "")
        If Len(Trim$(excelName)) > 0 Then
            If Trim$(t.Name) <> Trim$(excelName) Then
                t.Name = Trim$(excelName)
                nameChanges = nameChanges + 1
            End If
        End If

        If t.Summary Then
            skippedSummary = skippedSummary + 1
            GoTo NextRow
        End If

        rawPct = xlSheet.Cells(row, COL_PCT).Value
        If IsBlank(rawPct) Then GoTo NextRow
        If Not IsNumeric(rawPct) Then GoTo NextRow

        newPct = CDbl(rawPct)
        If newPct < 0 Then newPct = 0
        If newPct > 100 Then newPct = 100

        If t.PercentComplete <> newPct Then
            t.PercentComplete = newPct
            updated = updated + 1
        Else
            unchanged = unchanged + 1
        End If

NextRow:
    Next row

    xlBook.Close SaveChanges:=False
    xlApp.Quit
    Set xlSheet = Nothing
    Set xlBook = Nothing
    Set xlApp = Nothing
    Application.StatusBar = False

    MsgBox "Import finished." & vbCrLf & vbCrLf & _
           "% Complete updated: " & CStr(updated) & vbCrLf & _
           "% Complete unchanged: " & CStr(unchanged) & vbCrLf & _
           "Task names changed: " & CStr(nameChanges) & vbCrLf & _
           "Summary tasks skipped for % Complete: " & CStr(skippedSummary) & vbCrLf & _
           "UniqueID not found in Project: " & CStr(missing), _
           vbInformation, "Import Progress"
    Exit Sub

Fail:
    ' Capture before CleanupExcel — its On Error Resume Next clears Err.
    errNum = Err.Number
    errDesc = Err.Description
    Application.StatusBar = False
    CleanupExcel xlApp, xlBook
    MsgBox "Import failed:" & vbCrLf & errDesc & _
           IIf(errNum <> 0, " (Error " & CStr(errNum) & ")", ""), _
           vbCritical, "Import Progress"
End Sub

'------------------------------------------------------------------------------
' Helpers
'------------------------------------------------------------------------------

Private Function DefaultExcelPath() As String
    DefaultExcelPath = Environ$("USERPROFILE") & "\Documents\Programme_Progress.xlsx"
End Function

Private Function ResolveExcelPath(ByVal mustExist As Boolean) As String
    Dim path As String
    Dim prompt As String

    path = DefaultExcelPath()

    If mustExist Then
        If Dir(path) = "" Then
            prompt = "Excel progress file not found at default path." & vbCrLf & _
                     "Enter full path to the workbook:"
            path = InputBox(prompt, "Import Progress", path)
            If Len(Trim$(path)) = 0 Then
                ResolveExcelPath = ""
                Exit Function
            End If
        End If
    Else
        ' Allow override on export (first-run convenience).
        path = InputBox("Export workbook path (edit if needed):", "Export Progress", path)
        If Len(Trim$(path)) = 0 Then
            ResolveExcelPath = ""
            Exit Function
        End If
    End If

    ResolveExcelPath = Trim$(path)
End Function

Private Function CreateExcelApp() As Object
    On Error Resume Next
    Set CreateExcelApp = CreateObject("Excel.Application")
    On Error GoTo 0

    If CreateExcelApp Is Nothing Then
        MsgBox "Microsoft Excel is not installed or could not be started." & vbCrLf & _
               "Install Excel, then try again.", vbCritical, "Excel Required"
    Else
        CreateExcelApp.Visible = False
        CreateExcelApp.ScreenUpdating = False
    End If
End Function

Private Sub CleanupExcel(ByRef xlApp As Object, ByRef xlBook As Object)
    On Error Resume Next
    If Not xlBook Is Nothing Then xlBook.Close SaveChanges:=False
    If Not xlApp Is Nothing Then xlApp.Quit
    Set xlBook = Nothing
    Set xlApp = Nothing
    On Error GoTo 0
End Sub

Private Sub WriteHeaderRow(ByVal xlSheet As Object)
    xlSheet.Cells(HEADER_ROW, COL_UNIQUE_ID).Value = "UniqueID"
    xlSheet.Cells(HEADER_ROW, COL_TASK_NAME).Value = "Task Name"
    xlSheet.Cells(HEADER_ROW, COL_WBS).Value = "WBS"
    xlSheet.Cells(HEADER_ROW, COL_OUTLINE).Value = "Outline Level"
    xlSheet.Cells(HEADER_ROW, COL_START).Value = "Start"
    xlSheet.Cells(HEADER_ROW, COL_FINISH).Value = "Finish"
    xlSheet.Cells(HEADER_ROW, COL_PCT).Value = "% Complete"
    xlSheet.Cells(HEADER_ROW, COL_SUMMARY).Value = "Summary"
End Sub

Private Sub FormatProgressSheet(ByVal xlSheet As Object, ByVal lastDataRow As Long)
    Dim r As Long
    Dim isSummary As Boolean

    With xlSheet.Range(xlSheet.Cells(HEADER_ROW, COL_UNIQUE_ID), _
                       xlSheet.Cells(HEADER_ROW, COL_SUMMARY))
        .Font.Bold = True
    End With

    If lastDataRow >= FIRST_DATA_ROW Then
        xlSheet.Range(xlSheet.Cells(FIRST_DATA_ROW, COL_START), _
                      xlSheet.Cells(lastDataRow, COL_FINISH)).NumberFormat = "yyyy-mm-dd"
        xlSheet.Range(xlSheet.Cells(FIRST_DATA_ROW, COL_PCT), _
                      xlSheet.Cells(lastDataRow, COL_PCT)).NumberFormat = "0"
    End If

    xlSheet.Columns.AutoFit
    ' Extra width for indented deep-WBS names.
    If xlSheet.Columns(COL_TASK_NAME).ColumnWidth < 48 Then
        xlSheet.Columns(COL_TASK_NAME).ColumnWidth = 48
    End If

    ' Keep UniqueID present as join key, but hide column A so editors focus on
    ' Task Name / % Complete. Unhide in Excel if needed for troubleshooting.
    xlSheet.Columns(COL_UNIQUE_ID).Hidden = True

    ' Summary column stays visible so Arvin can filter to Summary="N" before
    ' editing % Complete (critical when many headings share leaf names).
    xlSheet.Columns(COL_SUMMARY).Hidden = False

    ' Lock join/context columns; unlock Task Name + leaf % Complete only.
    If lastDataRow >= FIRST_DATA_ROW Then
        xlSheet.Cells.Locked = False

        xlSheet.Range(xlSheet.Cells(FIRST_DATA_ROW, COL_UNIQUE_ID), _
                      xlSheet.Cells(lastDataRow, COL_UNIQUE_ID)).Locked = True
        xlSheet.Range(xlSheet.Cells(FIRST_DATA_ROW, COL_WBS), _
                      xlSheet.Cells(lastDataRow, COL_FINISH)).Locked = True
        xlSheet.Range(xlSheet.Cells(FIRST_DATA_ROW, COL_SUMMARY), _
                      xlSheet.Cells(lastDataRow, COL_SUMMARY)).Locked = True
        xlSheet.Range(xlSheet.Cells(HEADER_ROW, COL_UNIQUE_ID), _
                      xlSheet.Cells(HEADER_ROW, COL_SUMMARY)).Locked = True

        For r = FIRST_DATA_ROW To lastDataRow
            isSummary = (UCase$(Trim$(CStr(xlSheet.Cells(r, COL_SUMMARY).Value & ""))) = "Y")
            If isSummary Then
                ' Summaries roll up — lock % and grey the row slightly.
                xlSheet.Cells(r, COL_PCT).Locked = True
                xlSheet.Range(xlSheet.Cells(r, COL_TASK_NAME), _
                              xlSheet.Cells(r, COL_SUMMARY)).Interior.Color = RGB(242, 242, 242)
            Else
                xlSheet.Cells(r, COL_PCT).Locked = False
                xlSheet.Cells(r, COL_TASK_NAME).Locked = False
            End If
        Next r
    End If

    On Error Resume Next
    xlSheet.Range(xlSheet.Cells(HEADER_ROW, COL_UNIQUE_ID), _
                  xlSheet.Cells(lastDataRow, COL_SUMMARY)).AutoFilter
    ' AllowFiltering/AllowSorting so Summary=N filter works while protected.
    ' Do not Activate/Select here — Excel is usually Visible=False during export;
    ' Select on a hidden window raises 1004 and would abort before SaveAs.
    xlSheet.Protect Password:="", DrawingObjects:=True, Contents:=True, Scenarios:=True, _
                    UserInterfaceOnly:=True, AllowFiltering:=True, AllowSorting:=True
    On Error GoTo 0
End Sub

Private Sub EnsureParentFolder(ByVal filePath As String)
    Dim folder As String
    Dim pos As Long

    pos = InStrRev(filePath, "\")
    If pos = 0 Then Exit Sub
    folder = Left$(filePath, pos - 1)
    If Len(folder) = 0 Then Exit Sub
    If Dir(folder, vbDirectory) = "" Then
        On Error Resume Next
        MkDir folder
        On Error GoTo 0
    End If
End Sub

Private Function FindTaskByUniqueID(ByVal uid As Long) As Task
    Dim t As Task

    On Error Resume Next
    Set FindTaskByUniqueID = ActiveProject.Tasks.UniqueID(uid)
    If Err.Number <> 0 Then
        Err.Clear
        Set FindTaskByUniqueID = Nothing
        For Each t In ActiveProject.Tasks
            If Not t Is Nothing Then
                If t.UniqueID = uid Then
                    Set FindTaskByUniqueID = t
                    Exit For
                End If
            End If
        Next t
    End If
    On Error GoTo 0
End Function

Private Function IsBlank(ByVal v As Variant) As Boolean
    If IsNull(v) Then
        IsBlank = True
    ElseIf IsEmpty(v) Then
        IsBlank = True
    ElseIf VarType(v) = vbString Then
        IsBlank = (Len(Trim$(v)) = 0)
    Else
        IsBlank = False
    End If
End Function

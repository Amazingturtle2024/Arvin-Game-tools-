'==============================================================================
' ThisProject — MS Project ↔ Excel full two-way schedule sync
'
' Daily use: EditScheduleInExcel (alias: EditProgressInExcel)
'   export → open Excel → wait until close → import (edits + new rows).
'
' Syncs: Task Name, Start, Finish, Duration (days), % Complete.
' New Excel rows (blank UniqueID + name) create tasks in Project.
' Deletes only when Delete=Y — missing UniqueIDs are kept, never wiped.
' UniqueID is the join key (duplicate names are normal).
'
' Late-bound Excel.Application — no Excel library reference required.
'
' Paste tip: use docs/ThisProject-paste.bas (no VERSION/Attribute header).
'==============================================================================

Option Explicit

#If VBA7 Then
Private Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As Long)
#Else
Private Declare Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As Long)
#End If

'--- Config -------------------------------------------------------------------
Private Const PROGRESS_SHEET_NAME As String = "Progress"

' Column layout (1-based). UniqueID is the join key — do not remove.
Private Const COL_UNIQUE_ID As Long = 1
Private Const COL_TASK_NAME As Long = 2
Private Const COL_WBS As Long = 3
Private Const COL_OUTLINE As Long = 4
Private Const COL_START As Long = 5
Private Const COL_FINISH As Long = 6
Private Const COL_DURATION As Long = 7   ' working days (export/import)
Private Const COL_PCT As Long = 8
Private Const COL_SUMMARY As Long = 9   ' Y/N guide (export); not written back
Private Const COL_DELETE As Long = 10  ' set Y to delete that UniqueID on import

Private Const HEADER_ROW As Long = 1
Private Const FIRST_DATA_ROW As Long = 2
Private Const LAST_COL As Long = 10

Private Const EDIT_WAIT_PROMPT_MINUTES As Double = 5
Private Const EDIT_WAIT_MAX_MINUTES As Double = 90
Private Const EDIT_WAIT_SLEEP_MS As Long = 400

'------------------------------------------------------------------------------
' Public entry points
'------------------------------------------------------------------------------

' Preferred daily name.
Public Sub EditScheduleInExcel()
    EditProgressInExcel
End Sub

' Combined flow: export → open Excel → wait for close → full import.
Public Sub EditProgressInExcel()
    On Error GoTo Fail

    Dim excelPath As String
    Dim xlApp As Object
    Dim xlBook As Object
    Dim taskCount As Long
    Dim leafCount As Long
    Dim summaryCount As Long
    Dim cancelled As Boolean
    Dim errNum As Long
    Dim errDesc As String

    If ActiveProject Is Nothing Then
        MsgBox "No project is open.", vbExclamation, "Edit Schedule"
        Exit Sub
    End If

    CountProjectTasks taskCount, leafCount, summaryCount
    If taskCount = 0 Then
        MsgBox "This project has no tasks to export.", vbExclamation, "Edit Schedule"
        Exit Sub
    End If

    excelPath = ResolveExcelPath(False)
    If Len(excelPath) = 0 Then Exit Sub

    Application.StatusBar = "Exporting " & CStr(taskCount) & " tasks to Excel..."
    If Not WriteProgressWorkbook(excelPath, errNum, errDesc) Then
        Application.StatusBar = False
        MsgBox "Export failed:" & vbCrLf & errDesc & _
               IIf(errNum <> 0, " (Error " & CStr(errNum) & ")", ""), _
               vbCritical, "Edit Schedule"
        Exit Sub
    End If

    Set xlApp = CreateExcelApp(True)
    If xlApp Is Nothing Then
        Application.StatusBar = False
        Exit Sub
    End If

    xlApp.DisplayAlerts = True
    Set xlBook = xlApp.Workbooks.Open(excelPath)

    Application.StatusBar = "Edit schedule in Excel, save, then close Excel…"
    MsgBox "Schedule workbook is open in Excel:" & vbCrLf & excelPath & vbCrLf & vbCrLf & _
           "Exported " & CStr(taskCount) & " task(s) (" & CStr(leafCount) & " leaf / " & _
           CStr(summaryCount) & " summary)." & vbCrLf & vbCrLf & _
           "Edit freely:" & vbCrLf & _
           "• Task Name, Start, Finish, Duration (days), % Complete" & vbCrLf & _
           "• New row with blank UniqueID + Task Name = new task in Project" & vbCrLf & _
           "• Delete=Y on a row = delete that task (only — missing rows are kept)" & vbCrLf & _
           "• Filter Summary=N for leaf % edits (summaries roll up)" & vbCrLf & vbCrLf & _
           "Save (Ctrl+S), then close Excel. Click OK — Project waits, then imports.", _
           vbInformation, "Edit Schedule in Excel"

    cancelled = False
    If Not WaitUntilExcelClosed(xlApp, xlBook, excelPath, cancelled) Then
        Application.StatusBar = False
        If cancelled Then
            ' Leave Excel open with the user's workbook — do NOT Close/Quit.
            ReleaseExcelRefs xlApp, xlBook
            MsgBox "Import skipped. Excel was left open so you can keep editing." & vbCrLf & _
                   "When ready, save & close Excel, then run ImportProgressFromExcel" & vbCrLf & _
                   "(or run EditScheduleInExcel again).", _
                   vbExclamation, "Edit Schedule"
        Else
            ReleaseExcelRefs xlApp, xlBook
        End If
        Exit Sub
    End If

    ' Workbook/process closed — drop stale refs; import opens its own Excel.
    ReleaseExcelRefs xlApp, xlBook

    Application.StatusBar = "Importing schedule from Excel…"
    If Not ApplyScheduleFromWorkbook(excelPath, True, "Edit Schedule", errNum, errDesc) Then
        Application.StatusBar = False
        MsgBox "Import failed:" & vbCrLf & errDesc & _
               IIf(errNum <> 0, " (Error " & CStr(errNum) & ")", ""), _
               vbCritical, "Edit Schedule"
        Exit Sub
    End If

    Application.StatusBar = False
    Exit Sub

Fail:
    errNum = Err.Number
    errDesc = Err.Description
    Application.StatusBar = False
    ' Fail path may force-close a half-started automation instance only.
    CleanupExcel xlApp, xlBook
    MsgBox "Edit Schedule failed:" & vbCrLf & errDesc & _
           IIf(errNum <> 0, " (Error " & CStr(errNum) & ")", ""), _
           vbCritical, "Edit Schedule"
End Sub

' Standalone export only (does not open Excel).
Public Sub ExportProgressToExcel()
    On Error GoTo Fail

    Dim excelPath As String
    Dim taskCount As Long
    Dim leafCount As Long
    Dim summaryCount As Long
    Dim errNum As Long
    Dim errDesc As String

    If ActiveProject Is Nothing Then
        MsgBox "No project is open.", vbExclamation, "Export Schedule"
        Exit Sub
    End If

    CountProjectTasks taskCount, leafCount, summaryCount
    If taskCount = 0 Then
        MsgBox "This project has no tasks to export.", vbExclamation, "Export Schedule"
        Exit Sub
    End If

    excelPath = ResolveExcelPath(False)
    If Len(excelPath) = 0 Then Exit Sub

    Application.StatusBar = "Exporting " & CStr(taskCount) & " tasks to Excel..."
    If Not WriteProgressWorkbook(excelPath, errNum, errDesc) Then
        Application.StatusBar = False
        MsgBox "Export failed:" & vbCrLf & errDesc & _
               IIf(errNum <> 0, " (Error " & CStr(errNum) & ")", ""), _
               vbCritical, "Export Schedule"
        Exit Sub
    End If
    Application.StatusBar = False

    MsgBox "Exported " & CStr(taskCount) & " task(s) to:" & vbCrLf & excelPath & vbCrLf & vbCrLf & _
           "Leaf: " & CStr(leafCount) & " · Summary: " & CStr(summaryCount) & vbCrLf & vbCrLf & _
           "Tip: run EditScheduleInExcel for export → edit → auto-import." & vbCrLf & _
           "Or edit this file, then run ImportProgressFromExcel." & vbCrLf & _
           "UniqueID (column A, hidden) is the join key — do not clear existing IDs.", _
           vbInformation, "Export Schedule"
    Exit Sub

Fail:
    errNum = Err.Number
    errDesc = Err.Description
    Application.StatusBar = False
    MsgBox "Export failed:" & vbCrLf & errDesc & _
           IIf(errNum <> 0, " (Error " & CStr(errNum) & ")", ""), _
           vbCritical, "Export Schedule"
End Sub

Public Sub ImportProgressFromExcel()
    Dim excelPath As String
    Dim errNum As Long
    Dim errDesc As String

    If ActiveProject Is Nothing Then
        MsgBox "No project is open.", vbExclamation, "Import Schedule"
        Exit Sub
    End If

    excelPath = ResolveExcelPath(True)
    If Len(excelPath) = 0 Then Exit Sub

    If Dir(excelPath) = "" Then
        MsgBox "Excel file not found:" & vbCrLf & excelPath, vbExclamation, "Import Schedule"
        Exit Sub
    End If

    Application.StatusBar = "Importing schedule from Excel..."
    If Not ApplyScheduleFromWorkbook(excelPath, True, "Import Schedule", errNum, errDesc) Then
        Application.StatusBar = False
        MsgBox "Import failed:" & vbCrLf & errDesc & _
               IIf(errNum <> 0, " (Error " & CStr(errNum) & ")", ""), _
               vbCritical, "Import Schedule"
        Exit Sub
    End If
    Application.StatusBar = False
End Sub

'------------------------------------------------------------------------------
' Core export / import
'------------------------------------------------------------------------------

Private Sub CountProjectTasks(ByRef taskCount As Long, ByRef leafCount As Long, ByRef summaryCount As Long)
    Dim t As Task
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
End Sub

Private Function WriteProgressWorkbook(ByVal excelPath As String, _
                                       ByRef errNum As Long, _
                                       ByRef errDesc As String) As Boolean
    On Error GoTo Fail

    Dim xlApp As Object
    Dim xlBook As Object
    Dim xlSheet As Object
    Dim t As Task
    Dim row As Long
    Dim hoursPerDay As Double

    Set xlApp = CreateExcelApp(False)
    If xlApp Is Nothing Then
        errNum = 0
        errDesc = "Microsoft Excel is not installed or could not be started."
        WriteProgressWorkbook = False
        Exit Function
    End If

    hoursPerDay = ActiveProject.HoursPerDay
    If hoursPerDay <= 0 Then hoursPerDay = 8

    xlApp.DisplayAlerts = False
    Set xlBook = xlApp.Workbooks.Add
    Set xlSheet = xlBook.Worksheets(1)
    xlSheet.Name = PROGRESS_SHEET_NAME

    WriteHeaderRow xlSheet

    row = FIRST_DATA_ROW
    For Each t In ActiveProject.Tasks
        If Not t Is Nothing Then
            xlSheet.Cells(row, COL_UNIQUE_ID).Value = t.UniqueID
            xlSheet.Cells(row, COL_TASK_NAME).Value = t.Name
            xlSheet.Cells(row, COL_TASK_NAME).IndentLevel = _
                IIf(t.OutlineLevel > 15, 15, t.OutlineLevel)
            xlSheet.Cells(row, COL_WBS).Value = t.WBS
            xlSheet.Cells(row, COL_OUTLINE).Value = t.OutlineLevel
            xlSheet.Cells(row, COL_START).Value = t.Start
            xlSheet.Cells(row, COL_FINISH).Value = t.Finish
            ' Duration stored in minutes → working days
            xlSheet.Cells(row, COL_DURATION).Value = Round(t.Duration / 60# / hoursPerDay, 2)
            xlSheet.Cells(row, COL_PCT).Value = t.PercentComplete
            xlSheet.Cells(row, COL_SUMMARY).Value = IIf(t.Summary, "Y", "N")
            xlSheet.Cells(row, COL_DELETE).Value = ""
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

    WriteProgressWorkbook = True
    Exit Function

Fail:
    errNum = Err.Number
    errDesc = Err.Description
    CleanupExcel xlApp, xlBook
    WriteProgressWorkbook = False
End Function

Private Function ApplyScheduleFromWorkbook(ByVal excelPath As String, _
                                           ByVal showSummary As Boolean, _
                                           ByVal msgTitle As String, _
                                           ByRef errNum As Long, _
                                           ByRef errDesc As String) As Boolean
    On Error GoTo Fail

    Dim xlApp As Object
    Dim xlBook As Object
    Dim xlSheet As Object
    Dim lastRow As Long
    Dim row As Long
    Dim uid As Long
    Dim t As Task
    Dim excelName As String
    Dim rawUid As Variant
    Dim deleteFlag As String
    Dim updated As Long
    Dim created As Long
    Dim deleted As Long
    Dim skippedSummaryPct As Long
    Dim missing As Long
    Dim keptNotInExcel As Long
    Dim nameChanges As Long
    Dim dateChanges As Long
    Dim durChanges As Long
    Dim pctChanges As Long
    Dim skippedSummaryDelete As Long
    Dim excelUids As Object
    Dim deleteUids As Object
    Dim hoursPerDay As Double

    Set excelUids = CreateObject("Scripting.Dictionary")
    Set deleteUids = CreateObject("Scripting.Dictionary")
    hoursPerDay = ActiveProject.HoursPerDay
    If hoursPerDay <= 0 Then hoursPerDay = 8

    Set xlApp = CreateExcelApp(False)
    If xlApp Is Nothing Then
        errNum = 0
        errDesc = "Microsoft Excel is not installed or could not be started."
        ApplyScheduleFromWorkbook = False
        Exit Function
    End If

    xlApp.DisplayAlerts = False
    Set xlBook = xlApp.Workbooks.Open(excelPath, ReadOnly:=True)

    On Error Resume Next
    Set xlSheet = xlBook.Worksheets(PROGRESS_SHEET_NAME)
    On Error GoTo Fail

    If xlSheet Is Nothing Then
        CleanupExcel xlApp, xlBook
        errNum = 0
        errDesc = "Sheet '" & PROGRESS_SHEET_NAME & "' was not found in:" & vbCrLf & excelPath
        ApplyScheduleFromWorkbook = False
        Exit Function
    End If

    lastRow = xlSheet.Cells(xlSheet.Rows.Count, COL_TASK_NAME).End(-4162).row ' xlUp
    If lastRow < FIRST_DATA_ROW Then
        ' Also try UniqueID column in case names cleared
        lastRow = xlSheet.Cells(xlSheet.Rows.Count, COL_UNIQUE_ID).End(-4162).row
    End If
    If lastRow < FIRST_DATA_ROW Then
        CleanupExcel xlApp, xlBook
        errNum = 0
        errDesc = "No task rows found on sheet '" & PROGRESS_SHEET_NAME & "'."
        ApplyScheduleFromWorkbook = False
        Exit Function
    End If

    updated = 0
    created = 0
    deleted = 0
    skippedSummaryPct = 0
    skippedSummaryDelete = 0
    missing = 0
    keptNotInExcel = 0
    nameChanges = 0
    dateChanges = 0
    durChanges = 0
    pctChanges = 0

    ' Pass 0: collect Delete=Y UniqueIDs so summary deletes can require all children flagged.
    For row = FIRST_DATA_ROW To lastRow
        rawUid = xlSheet.Cells(row, COL_UNIQUE_ID).Value
        deleteFlag = UCase$(Trim$(CStr(xlSheet.Cells(row, COL_DELETE).Value & "")))
        If deleteFlag = "Y" And Not IsBlank(rawUid) And IsNumeric(rawUid) Then
            If Not deleteUids.Exists(CStr(CLng(rawUid))) Then deleteUids.Add CStr(CLng(rawUid)), True
        End If
    Next row

    ' Pass 1: deletes + updates + creates
    For row = FIRST_DATA_ROW To lastRow
        excelName = CStr(xlSheet.Cells(row, COL_TASK_NAME).Value & "")
        rawUid = xlSheet.Cells(row, COL_UNIQUE_ID).Value
        deleteFlag = UCase$(Trim$(CStr(xlSheet.Cells(row, COL_DELETE).Value & "")))

        ' Skip completely empty rows
        If IsBlank(rawUid) And Len(Trim$(excelName)) = 0 And deleteFlag <> "Y" Then GoTo NextRow

        If Not IsBlank(rawUid) And IsNumeric(rawUid) Then
            uid = CLng(rawUid)
            If Not excelUids.Exists(CStr(uid)) Then excelUids.Add CStr(uid), True

            Set t = FindTaskByUniqueID(uid)
            If t Is Nothing Then
                missing = missing + 1
                GoTo NextRow
            End If

            If deleteFlag = "Y" Then
                ' Opt-in delete only — never delete merely because a row was removed.
                If t.UniqueID = 0 Then GoTo NextRow ' protect project summary
                If t.Summary Then
                    If Not AllDescendantsMarkedDelete(t, deleteUids) Then
                        skippedSummaryDelete = skippedSummaryDelete + 1
                        GoTo NextRow
                    End If
                End If
                t.Delete
                deleted = deleted + 1
                GoTo NextRow
            End If

            ApplyTaskFieldsFromRow xlSheet, row, t, hoursPerDay, _
                nameChanges, dateChanges, durChanges, pctChanges, skippedSummaryPct, updated
        Else
            ' Blank / non-numeric UniqueID → create new task if a name is present.
            If Len(Trim$(excelName)) = 0 Then GoTo NextRow
            If deleteFlag = "Y" Then GoTo NextRow ' nothing to delete

            Set t = CreateTaskFromRow(xlSheet, row, hoursPerDay)
            If Not t Is Nothing Then
                created = created + 1
                If Not excelUids.Exists(CStr(t.UniqueID)) Then excelUids.Add CStr(t.UniqueID), True
            End If
        End If

NextRow:
    Next row

    ' Pass 2: Project tasks whose UniqueID is absent from Excel are KEPT
    ' (not deleted). Count for the summary so intent is visible.
    Dim pt As Task
    For Each pt In ActiveProject.Tasks
        If Not pt Is Nothing Then
            If Not excelUids.Exists(CStr(pt.UniqueID)) Then
                keptNotInExcel = keptNotInExcel + 1
            End If
        End If
    Next pt

    xlBook.Close SaveChanges:=False
    xlApp.Quit
    Set xlSheet = Nothing
    Set xlBook = Nothing
    Set xlApp = Nothing

    If showSummary Then
        MsgBox "Import finished." & vbCrLf & vbCrLf & _
               "Tasks updated: " & CStr(updated) & vbCrLf & _
               "  · names: " & CStr(nameChanges) & _
               "  · dates: " & CStr(dateChanges) & _
               "  · duration: " & CStr(durChanges) & _
               "  · % Complete: " & CStr(pctChanges) & vbCrLf & _
               "Tasks created: " & CStr(created) & vbCrLf & _
               "Tasks deleted (Delete=Y): " & CStr(deleted) & vbCrLf & _
               "Summary deletes skipped (children not all Delete=Y): " & CStr(skippedSummaryDelete) & vbCrLf & _
               "Summary % Complete skipped: " & CStr(skippedSummaryPct) & vbCrLf & _
               "UniqueID in Excel not found: " & CStr(missing) & vbCrLf & _
               "Project tasks kept (not in Excel): " & CStr(keptNotInExcel) & vbCrLf & vbCrLf & _
               "Note: rows missing from Excel are NOT deleted unless Delete=Y." & vbCrLf & _
               "Summary Delete=Y also requires Delete=Y on every child.", _
               vbInformation, msgTitle
    End If

    ApplyScheduleFromWorkbook = True
    Exit Function

Fail:
    errNum = Err.Number
    errDesc = Err.Description
    CleanupExcel xlApp, xlBook
    ApplyScheduleFromWorkbook = False
End Function

Private Sub ApplyTaskFieldsFromRow(ByVal xlSheet As Object, ByVal row As Long, ByVal t As Task, _
                                   ByVal hoursPerDay As Double, _
                                   ByRef nameChanges As Long, ByRef dateChanges As Long, _
                                   ByRef durChanges As Long, ByRef pctChanges As Long, _
                                   ByRef skippedSummaryPct As Long, ByRef updated As Long)
    Dim excelName As String
    Dim rawStart As Variant
    Dim rawFinish As Variant
    Dim rawDur As Variant
    Dim rawPct As Variant
    Dim newPct As Double
    Dim newDurMin As Double
    Dim curDurDays As Double
    Dim startChanged As Boolean
    Dim finishChanged As Boolean
    Dim durationChanged As Boolean
    Dim newStart As Date
    Dim newFinish As Date
    Dim touched As Boolean

    touched = False

    excelName = CStr(xlSheet.Cells(row, COL_TASK_NAME).Value & "")
    If Len(Trim$(excelName)) > 0 Then
        If Trim$(t.Name) <> Trim$(excelName) Then
            t.Name = Trim$(excelName)
            nameChanges = nameChanges + 1
            touched = True
        End If
    End If

    ' Detect which schedule fields the user actually changed. Never write
    ' Start+Finish+Duration together — a stale Duration after date edits
    ' reverts Finish, and needless date writes plant SNET/FNLT constraints.
    ' Never DateValue-only midnights: keep Excel time if present, else Project
    ' DefaultStartTime / DefaultEndTime (fallback 08:00 / 17:00).
    ' Milestones (Duration 0 / t.Milestone): one working instant — DefaultStartTime
    ' only; never DefaultEndTime (that expands 0-day into 08:00–17:00).
    ' Never CDate(t.Start/Finish) when Project says NA — that aborts import.
    Dim curStart As Date
    Dim curFinish As Date
    Dim hasCurStart As Boolean
    Dim hasCurFinish As Boolean
    Dim treatAsMilestone As Boolean
    Dim milestoneInstant As Date
    Dim hasExcelDur As Boolean

    startChanged = False
    finishChanged = False
    durationChanged = False
    treatAsMilestone = False
    hasExcelDur = False
    newDurMin = -1

    rawDur = xlSheet.Cells(row, COL_DURATION).Value
    If Not IsBlank(rawDur) And IsNumeric(rawDur) Then
        hasExcelDur = True
        newDurMin = CDbl(rawDur) * 60# * hoursPerDay
        If newDurMin < 0 Then newDurMin = 0
        If Abs(CDbl(rawDur)) < 0.0001 Then treatAsMilestone = True
        On Error Resume Next
        curDurDays = Round(t.Duration / 60# / hoursPerDay, 2)
        If Err.Number = 0 Then
            If Abs(curDurDays - Round(CDbl(rawDur), 2)) > 0.009 Then durationChanged = True
        Else
            durationChanged = True
        End If
        Err.Clear
        On Error GoTo 0
    Else
        On Error Resume Next
        If t.Milestone Or t.Duration = 0 Then treatAsMilestone = True
        Err.Clear
        On Error GoTo 0
    End If

    rawStart = xlSheet.Cells(row, COL_START).Value
    If ExcelCellToProjectDate(rawStart, False, newStart) Then
        hasCurStart = TryGetTaskDate(t.Start, curStart)
        If Not hasCurStart Then
            startChanged = True
        ElseIf DateValue(curStart) <> DateValue(newStart) Then
            startChanged = True
        ElseIf ExcelValueHasTime(rawStart) And Abs(DateDiff("n", curStart, newStart)) > 0 Then
            startChanged = True
        End If
    End If

    rawFinish = xlSheet.Cells(row, COL_FINISH).Value
    ' Milestones: date-only finish uses start-of-day working time, not end-of-day.
    If ExcelCellToProjectDate(rawFinish, Not treatAsMilestone, newFinish) Then
        If treatAsMilestone And Not ExcelValueHasTime(rawFinish) Then
            ' Same calendar day finish as a zero-length instant at start time.
            newFinish = DateValue(newFinish) + TimeValue(ProjectDefaultStartTime())
        End If
        hasCurFinish = TryGetTaskDate(t.Finish, curFinish)
        If treatAsMilestone Then
            ' Only treat finish as changed when the calendar day moves (or explicit time).
            If Not hasCurFinish Then
                finishChanged = True
            ElseIf DateValue(curFinish) <> DateValue(newFinish) Then
                finishChanged = True
            ElseIf ExcelValueHasTime(rawFinish) And Abs(DateDiff("n", curFinish, newFinish)) > 0 Then
                finishChanged = True
            End If
        Else
            If Not hasCurFinish Then
                finishChanged = True
            ElseIf DateValue(curFinish) <> DateValue(newFinish) Then
                finishChanged = True
            ElseIf ExcelValueHasTime(rawFinish) And Abs(DateDiff("n", curFinish, newFinish)) > 0 Then
                finishChanged = True
            End If
        End If
    End If

    On Error Resume Next
    If treatAsMilestone And (startChanged Or finishChanged Or durationChanged) Then
        ' Keep milestone: Duration 0, Start=Finish at one working instant.
        If startChanged Then
            milestoneInstant = newStart
        ElseIf finishChanged Then
            milestoneInstant = newFinish
        ElseIf hasCurStart Then
            milestoneInstant = curStart
        ElseIf ExcelCellToProjectDate(rawStart, False, milestoneInstant) Then
            ' ok
        ElseIf ExcelCellToProjectDate(rawFinish, False, milestoneInstant) Then
            ' ok
        Else
            GoTo AfterScheduleApply
        End If

        t.Duration = 0
        If Err.Number = 0 And hasExcelDur And durationChanged Then
            durChanges = durChanges + 1
            touched = True
        End If
        Err.Clear

        t.Start = milestoneInstant
        If Err.Number = 0 Then
            If startChanged Or finishChanged Then
                dateChanges = dateChanges + 1
                touched = True
            End If
        End If
        Err.Clear

        ' Ensure Finish matches Start (Project usually does this for Duration=0).
        t.Finish = milestoneInstant
        Err.Clear
        If Not t.Milestone Then t.Milestone = True
        Err.Clear
    ElseIf (Not treatAsMilestone) And (startChanged Or finishChanged Or durationChanged) Then
        If durationChanged And Not startChanged And Not finishChanged Then
            t.Duration = newDurMin
            If Err.Number = 0 Then
                durChanges = durChanges + 1
                touched = True
            End If
            Err.Clear
        ElseIf startChanged And durationChanged Then
            t.Start = newStart
            If Err.Number = 0 Then
                dateChanges = dateChanges + 1
                touched = True
            End If
            Err.Clear
            t.Duration = newDurMin
            If Err.Number = 0 Then
                durChanges = durChanges + 1
                touched = True
            End If
            Err.Clear
        ElseIf startChanged And finishChanged And Not durationChanged Then
            t.Start = newStart
            If Err.Number = 0 Then
                dateChanges = dateChanges + 1
                touched = True
            End If
            Err.Clear
            t.Finish = newFinish
            If Err.Number = 0 Then
                dateChanges = dateChanges + 1
                touched = True
            End If
            Err.Clear
        ElseIf startChanged And Not finishChanged And Not durationChanged Then
            t.Start = newStart
            If Err.Number = 0 Then
                dateChanges = dateChanges + 1
                touched = True
            End If
            Err.Clear
        ElseIf finishChanged And Not startChanged And Not durationChanged Then
            t.Finish = newFinish
            If Err.Number = 0 Then
                dateChanges = dateChanges + 1
                touched = True
            End If
            Err.Clear
        ElseIf finishChanged And durationChanged And Not startChanged Then
            t.Duration = newDurMin
            If Err.Number = 0 Then
                durChanges = durChanges + 1
                touched = True
            End If
            Err.Clear
        ElseIf startChanged And finishChanged And durationChanged Then
            t.Start = newStart
            If Err.Number = 0 Then
                dateChanges = dateChanges + 1
                touched = True
            End If
            Err.Clear
            t.Duration = newDurMin
            If Err.Number = 0 Then
                durChanges = durChanges + 1
                touched = True
            End If
            Err.Clear
        End If
    End If
AfterScheduleApply:
    On Error GoTo 0

    ' Leaf-only % Complete — summaries roll up from children.
    If t.Summary Then
        skippedSummaryPct = skippedSummaryPct + 1
    Else
        rawPct = xlSheet.Cells(row, COL_PCT).Value
        If Not IsBlank(rawPct) And IsNumeric(rawPct) Then
            newPct = CDbl(rawPct)
            If newPct < 0 Then newPct = 0
            If newPct > 100 Then newPct = 100
            If t.PercentComplete <> newPct Then
                t.PercentComplete = newPct
                pctChanges = pctChanges + 1
                touched = True
            End If
        End If
    End If

    If touched Then updated = updated + 1
End Sub

Private Function CreateTaskFromRow(ByVal xlSheet As Object, ByVal row As Long, _
                                   ByVal hoursPerDay As Double) As Task
    Dim t As Task
    Dim excelName As String
    Dim desiredOutline As Long
    Dim rawOutline As Variant
    Dim parentWbs As String
    Dim parentTask As Task
    Dim rawWbs As Variant

    On Error GoTo FailCreate

    excelName = Trim$(CStr(xlSheet.Cells(row, COL_TASK_NAME).Value & ""))
    If Len(excelName) = 0 Then
        Set CreateTaskFromRow = Nothing
        Exit Function
    End If

    ' Outline Level is optional. Only adjust if Excel explicitly set a numeric
    ' level — never default to 1 after a WBS-parent insert (that outdents and
    ' reparents following tasks).
    Dim hasExplicitOutline As Boolean
    rawOutline = xlSheet.Cells(row, COL_OUTLINE).Value
    hasExplicitOutline = (Not IsBlank(rawOutline) And IsNumeric(rawOutline))
    desiredOutline = 0
    If hasExplicitOutline Then
        desiredOutline = CLng(rawOutline)
        If desiredOutline < 1 Then desiredOutline = 1
    End If

    rawWbs = xlSheet.Cells(row, COL_WBS).Value
    parentWbs = Trim$(CStr(rawWbs & ""))
    If Len(parentWbs) > 0 Then
        ' If user typed a child WBS like 1.6.9, parent hint is 1.6
        If InStrRev(parentWbs, ".") > 0 Then
            parentWbs = Left$(parentWbs, InStrRev(parentWbs, ".") - 1)
        Else
            parentWbs = ""
        End If
    End If

    Set parentTask = Nothing
    If Len(parentWbs) > 0 Then Set parentTask = FindTaskByWBS(parentWbs)

    If Not parentTask Is Nothing Then
        ' Add after last child of parent when possible; else after parent.
        Set t = ActiveProject.Tasks.Add(excelName, parentTask.ID + CountDescendants(parentTask) + 1)
    Else
        Set t = ActiveProject.Tasks.Add(excelName)
    End If

    If hasExplicitOutline Then AdjustOutlineLevel t, desiredOutline

    ' Apply remaining fields (dates / duration / %).
    Dim nc As Long, dc As Long, duc As Long, pc As Long, sk As Long, up As Long
    ApplyTaskFieldsFromRow xlSheet, row, t, hoursPerDay, nc, dc, duc, pc, sk, up

    Set CreateTaskFromRow = t
    Exit Function

FailCreate:
    Set CreateTaskFromRow = Nothing
End Function

Private Function CountDescendants(ByVal parentTask As Task) As Long
    Dim t As Task
    Dim n As Long
    n = 0
    For Each t In ActiveProject.Tasks
        If Not t Is Nothing Then
            If t.ID > parentTask.ID Then
                If t.OutlineLevel <= parentTask.OutlineLevel Then Exit For
                n = n + 1
            End If
        End If
    Next t
    CountDescendants = n
End Function

Private Sub AdjustOutlineLevel(ByVal t As Task, ByVal desired As Long)
    Dim guard As Long
    On Error Resume Next
    guard = 0
    Do While t.OutlineLevel < desired And guard < 20
        t.OutlineIndent
        guard = guard + 1
    Loop
    guard = 0
    Do While t.OutlineLevel > desired And guard < 20
        t.OutlineOutdent
        guard = guard + 1
    Loop
    On Error GoTo 0
End Sub

Private Function FindTaskByWBS(ByVal wbs As String) As Task
    Dim t As Task
    For Each t In ActiveProject.Tasks
        If Not t Is Nothing Then
            If StrComp(Trim$(CStr(t.WBS & "")), Trim$(wbs), vbTextCompare) = 0 Then
                Set FindTaskByWBS = t
                Exit Function
            End If
        End If
    Next t
    Set FindTaskByWBS = Nothing
End Function

'------------------------------------------------------------------------------
' Edit-session wait helpers
'------------------------------------------------------------------------------

Private Function WaitUntilExcelClosed(ByVal xlApp As Object, _
                                      ByVal xlBook As Object, _
                                      ByVal excelPath As String, _
                                      ByRef cancelled As Boolean) As Boolean
    Dim waitStart As Date
    Dim lastPrompt As Date
    Dim resp As VbMsgBoxResult
    Dim stillOpen As Boolean

    cancelled = False
    waitStart = Now
    lastPrompt = Now

    Do
        Sleep EDIT_WAIT_SLEEP_MS
        DoEvents

        stillOpen = IsProgressSessionOpen(xlApp, xlBook, excelPath)
        If Not stillOpen Then
            WaitUntilExcelClosed = True
            Exit Function
        End If

        If DateDiff("n", lastPrompt, Now) >= EDIT_WAIT_PROMPT_MINUTES Then
            resp = MsgBox("Still waiting for you to save and close Excel…" & vbCrLf & vbCrLf & _
                          "Yes = keep waiting" & vbCrLf & _
                          "No = skip automatic import (Excel stays open)", _
                          vbYesNo Or vbQuestion, "Edit Schedule")
            lastPrompt = Now
            If resp = vbNo Then
                cancelled = True
                WaitUntilExcelClosed = False
                Exit Function
            End If
        End If

        If DateDiff("n", waitStart, Now) >= EDIT_WAIT_MAX_MINUTES Then
            resp = MsgBox("Timed out after " & CStr(EDIT_WAIT_MAX_MINUTES) & " minutes." & vbCrLf & vbCrLf & _
                          "Yes = keep waiting another " & CStr(EDIT_WAIT_MAX_MINUTES) & " minutes" & vbCrLf & _
                          "No = skip automatic import (Excel stays open)", _
                          vbYesNo Or vbExclamation, "Edit Schedule")
            If resp = vbNo Then
                cancelled = True
                WaitUntilExcelClosed = False
                Exit Function
            End If
            waitStart = Now
            lastPrompt = Now
        End If
    Loop
End Function

Private Function IsProgressSessionOpen(ByVal xlApp As Object, _
                                       ByVal xlBook As Object, _
                                       ByVal excelPath As String) As Boolean
    Dim wb As Object
    Dim n As Long
    Dim fullName As String
    Dim errN As Long

    On Error Resume Next

    If xlApp Is Nothing Then
        IsProgressSessionOpen = False
        Exit Function
    End If

    ' Probe application. While a cell is being edited, Excel often returns 1004
    ' to automation — that means STILL OPEN, not closed.
    Err.Clear
    n = xlApp.Workbooks.Count
    errN = Err.Number
    If errN <> 0 Then
        Err.Clear
        If IsExcelBusyOrTransientError(errN) Then
            IsProgressSessionOpen = True
        Else
            IsProgressSessionOpen = False
        End If
        Exit Function
    End If

    ' Prefer workbook object FullName when readable.
    If Not xlBook Is Nothing Then
        Err.Clear
        fullName = xlBook.FullName
        errN = Err.Number
        If errN <> 0 Then
            Err.Clear
            If IsExcelBusyOrTransientError(errN) Then
                IsProgressSessionOpen = True
                Exit Function
            End If
            ' Fall through to collection scan
        ElseIf PathsReferToSameWorkbook(fullName, excelPath) Then
            IsProgressSessionOpen = True
            Exit Function
        End If
    End If

    ' Scan open workbooks — match full path OR filename (OneDrive URL vs local).
    Err.Clear
    For Each wb In xlApp.Workbooks
        Err.Clear
        fullName = wb.FullName
        errN = Err.Number
        If errN <> 0 Then
            Err.Clear
            If IsExcelBusyOrTransientError(errN) Then
                IsProgressSessionOpen = True
                Exit Function
            End If
        Else
            If PathsReferToSameWorkbook(fullName, excelPath) Then
                IsProgressSessionOpen = True
                Exit Function
            End If
        End If
        ' Filename fallback
        Err.Clear
        If StrComp(wb.Name, FileNameOnly(excelPath), vbTextCompare) = 0 Then
            IsProgressSessionOpen = True
            Exit Function
        End If
    Next wb

    ' No matching workbook. If Excel has zero books, quit our empty instance.
    If n = 0 Then
        Err.Clear
        xlApp.DisplayAlerts = False
        xlApp.Quit
    End If
    IsProgressSessionOpen = False
End Function

Private Function IsExcelBusyOrTransientError(ByVal errN As Long) As Boolean
    ' 1004 = application-defined / often "Excel is busy" during in-cell edit
    ' -2147418111 (0x80010001) RPC_E_CALL_REJECTED — Excel rejecting re-entrancy
    ' -2146777998 (0x800AC472) VBA_E_IGNORE — Excel ignoring calls while UI busy
    ' Do NOT treat -2147417848 (RPC_E_DISCONNECTED) as busy — that means Excel
    ' has quit and the wait loop must end so auto-import can run.
    Select Case errN
        Case 1004, -2147418111, -2146777998
            IsExcelBusyOrTransientError = True
        Case Else
            IsExcelBusyOrTransientError = False
    End Select
End Function

' Summary Delete=Y is refused unless every descendant UniqueID is also Delete=Y.
Private Function AllDescendantsMarkedDelete(ByVal summaryTask As Task, ByVal deleteUids As Object) As Boolean
    Dim t As Task
    Dim anyChild As Boolean

    anyChild = False
    For Each t In ActiveProject.Tasks
        If Not t Is Nothing Then
            If t.ID > summaryTask.ID Then
                If t.OutlineLevel <= summaryTask.OutlineLevel Then Exit For
                anyChild = True
                If Not deleteUids.Exists(CStr(t.UniqueID)) Then
                    AllDescendantsMarkedDelete = False
                    Exit Function
                End If
            End If
        End If
    Next t

    ' No children (shouldn't be summary) — allow.
    AllDescendantsMarkedDelete = True
End Function

Private Function PathsReferToSameWorkbook(ByVal pathA As String, ByVal pathB As String) As Boolean
    Dim a As String
    Dim b As String
    a = Trim$(pathA)
    b = Trim$(pathB)
    If Len(a) = 0 Or Len(b) = 0 Then Exit Function

    If StrComp(a, b, vbTextCompare) = 0 Then
        PathsReferToSameWorkbook = True
        Exit Function
    End If

    ' Filename-only match (OneDrive/SharePoint FullName vs local path).
    If StrComp(FileNameOnly(a), FileNameOnly(b), vbTextCompare) = 0 Then
        PathsReferToSameWorkbook = True
        Exit Function
    End If

    ' Normalize backslashes / forward slashes for a softer compare
    a = Replace(LCase$(a), "/", "\")
    b = Replace(LCase$(b), "/", "\")
    If a = b Then
        PathsReferToSameWorkbook = True
        Exit Function
    End If

    PathsReferToSameWorkbook = False
End Function

Private Function FileNameOnly(ByVal path As String) As String
    Dim p As Long
    Dim s As String
    s = Replace(path, "/", "\")
    p = InStrRev(s, "\")
    If p = 0 Then
        FileNameOnly = s
    Else
        FileNameOnly = Mid$(s, p + 1)
    End If
End Function

'------------------------------------------------------------------------------
' Shared helpers
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
            prompt = "Excel schedule file not found at default path." & vbCrLf & _
                     "Enter full path to the workbook:"
            path = InputBox(prompt, "Import Schedule", path)
            If Len(Trim$(path)) = 0 Then
                ResolveExcelPath = ""
                Exit Function
            End If
        End If
    Else
        path = InputBox("Workbook path (edit if needed):", "Schedule Excel Path", path)
        If Len(Trim$(path)) = 0 Then
            ResolveExcelPath = ""
            Exit Function
        End If
    End If

    ResolveExcelPath = Trim$(path)
End Function

Private Function CreateExcelApp(Optional ByVal visible As Boolean = False) As Object
    On Error Resume Next
    Set CreateExcelApp = CreateObject("Excel.Application")
    On Error GoTo 0

    If CreateExcelApp Is Nothing Then
        MsgBox "Microsoft Excel is not installed or could not be started." & vbCrLf & _
               "Install Excel, then try again.", vbCritical, "Excel Required"
    Else
        CreateExcelApp.Visible = visible
        CreateExcelApp.ScreenUpdating = visible
    End If
End Function

' Force-close (error paths / hidden automation only).
Private Sub CleanupExcel(ByRef xlApp As Object, ByRef xlBook As Object)
    On Error Resume Next
    If Not xlBook Is Nothing Then xlBook.Close SaveChanges:=False
    If Not xlApp Is Nothing Then xlApp.Quit
    Set xlBook = Nothing
    Set xlApp = Nothing
    On Error GoTo 0
End Sub

' Drop COM refs without closing the user's visible Excel session.
Private Sub ReleaseExcelRefs(ByRef xlApp As Object, ByRef xlBook As Object)
    Set xlBook = Nothing
    Set xlApp = Nothing
End Sub

Private Sub WriteHeaderRow(ByVal xlSheet As Object)
    xlSheet.Cells(HEADER_ROW, COL_UNIQUE_ID).Value = "UniqueID"
    xlSheet.Cells(HEADER_ROW, COL_TASK_NAME).Value = "Task Name"
    xlSheet.Cells(HEADER_ROW, COL_WBS).Value = "WBS"
    xlSheet.Cells(HEADER_ROW, COL_OUTLINE).Value = "Outline Level"
    xlSheet.Cells(HEADER_ROW, COL_START).Value = "Start"
    xlSheet.Cells(HEADER_ROW, COL_FINISH).Value = "Finish"
    xlSheet.Cells(HEADER_ROW, COL_DURATION).Value = "Duration (days)"
    xlSheet.Cells(HEADER_ROW, COL_PCT).Value = "% Complete"
    xlSheet.Cells(HEADER_ROW, COL_SUMMARY).Value = "Summary"
    xlSheet.Cells(HEADER_ROW, COL_DELETE).Value = "Delete"
End Sub

Private Sub FormatProgressSheet(ByVal xlSheet As Object, ByVal lastDataRow As Long)
    Dim r As Long
    Dim isSummary As Boolean

    With xlSheet.Range(xlSheet.Cells(HEADER_ROW, COL_UNIQUE_ID), _
                       xlSheet.Cells(HEADER_ROW, LAST_COL))
        .Font.Bold = True
    End With

    If lastDataRow >= FIRST_DATA_ROW Then
        xlSheet.Range(xlSheet.Cells(FIRST_DATA_ROW, COL_START), _
                      xlSheet.Cells(lastDataRow, COL_FINISH)).NumberFormat = "yyyy-mm-dd"
        xlSheet.Range(xlSheet.Cells(FIRST_DATA_ROW, COL_DURATION), _
                      xlSheet.Cells(lastDataRow, COL_DURATION)).NumberFormat = "0.00"
        xlSheet.Range(xlSheet.Cells(FIRST_DATA_ROW, COL_PCT), _
                      xlSheet.Cells(lastDataRow, COL_PCT)).NumberFormat = "0"
    End If

    xlSheet.Columns.AutoFit
    If xlSheet.Columns(COL_TASK_NAME).ColumnWidth < 48 Then
        xlSheet.Columns(COL_TASK_NAME).ColumnWidth = 48
    End If

    xlSheet.Columns(COL_UNIQUE_ID).Hidden = True
    xlSheet.Columns(COL_SUMMARY).Hidden = False
    xlSheet.Columns(COL_DELETE).Hidden = False

    If lastDataRow >= FIRST_DATA_ROW Then
        xlSheet.Cells.Locked = False

        xlSheet.Range(xlSheet.Cells(FIRST_DATA_ROW, COL_UNIQUE_ID), _
                      xlSheet.Cells(lastDataRow, COL_UNIQUE_ID)).Locked = True
        xlSheet.Range(xlSheet.Cells(FIRST_DATA_ROW, COL_WBS), _
                      xlSheet.Cells(lastDataRow, COL_WBS)).Locked = True
        xlSheet.Range(xlSheet.Cells(FIRST_DATA_ROW, COL_SUMMARY), _
                      xlSheet.Cells(lastDataRow, COL_SUMMARY)).Locked = True
        xlSheet.Range(xlSheet.Cells(HEADER_ROW, COL_UNIQUE_ID), _
                      xlSheet.Cells(HEADER_ROW, LAST_COL)).Locked = True

        ' Editable: Name, Outline, Start, Finish, Duration, %, Delete
        For r = FIRST_DATA_ROW To lastDataRow
            isSummary = (UCase$(Trim$(CStr(xlSheet.Cells(r, COL_SUMMARY).Value & ""))) = "Y")
            xlSheet.Cells(r, COL_TASK_NAME).Locked = False
            xlSheet.Cells(r, COL_OUTLINE).Locked = False
            xlSheet.Cells(r, COL_START).Locked = False
            xlSheet.Cells(r, COL_FINISH).Locked = False
            xlSheet.Cells(r, COL_DURATION).Locked = False
            xlSheet.Cells(r, COL_DELETE).Locked = False
            If isSummary Then
                xlSheet.Cells(r, COL_PCT).Locked = True
                xlSheet.Range(xlSheet.Cells(r, COL_TASK_NAME), _
                              xlSheet.Cells(r, COL_SUMMARY)).Interior.Color = RGB(242, 242, 242)
            Else
                xlSheet.Cells(r, COL_PCT).Locked = False
            End If
        Next r
    End If

    On Error Resume Next
    xlSheet.Range(xlSheet.Cells(HEADER_ROW, COL_UNIQUE_ID), _
                  xlSheet.Cells(lastDataRow, LAST_COL)).AutoFilter
    ' Do not Activate/Select — hidden Excel Select raises 1004 before SaveAs.
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

' Safe read of Project task Start/Finish — "NA" must not raise into Fail.
Private Function TryGetTaskDate(ByVal v As Variant, ByRef outDate As Date) As Boolean
    On Error Resume Next
    If IsNull(v) Or IsEmpty(v) Then Exit Function
    If VarType(v) = vbString Then
        If Len(Trim$(CStr(v))) = 0 Then Exit Function
        If StrComp(Trim$(CStr(v)), "NA", vbTextCompare) = 0 Then Exit Function
    End If
    If Not IsDate(v) Then Exit Function
    Err.Clear
    outDate = CDate(v)
    If Err.Number <> 0 Then
        Err.Clear
        Exit Function
    End If
    TryGetTaskDate = True
End Function

Private Function ExcelValueHasTime(ByVal raw As Variant) As Boolean
    On Error Resume Next
    If IsBlank(raw) Or Not IsDate(raw) Then Exit Function
    ExcelValueHasTime = (TimeValue(CDate(raw)) <> 0)
    If Err.Number <> 0 Then
        Err.Clear
        ExcelValueHasTime = False
    End If
End Function

Private Function ProjectDefaultStartTime() As Date
    On Error Resume Next
    ProjectDefaultStartTime = ActiveProject.DefaultStartTime
    If Err.Number <> 0 Or TimeValue(ProjectDefaultStartTime) = 0 Then
        Err.Clear
        ProjectDefaultStartTime = TimeSerial(8, 0, 0)
    End If
End Function

Private Function ProjectDefaultEndTime() As Date
    On Error Resume Next
    ProjectDefaultEndTime = ActiveProject.DefaultEndTime
    If Err.Number <> 0 Or TimeValue(ProjectDefaultEndTime) = 0 Then
        Err.Clear
        ProjectDefaultEndTime = TimeSerial(17, 0, 0)
    End If
End Function

' Build a Project datetime from an Excel cell: keep explicit times; for
' date-only (midnight) cells use DefaultStartTime (isFinish=False) or
' DefaultEndTime (isFinish=True). Callers must pass isFinish=False for
' milestones so Duration 0 stays a single working instant (not 08:00–17:00).
Private Function ExcelCellToProjectDate(ByVal raw As Variant, ByVal isFinish As Boolean, _
                                        ByRef outDate As Date) As Boolean
    Dim d As Date
    Dim defT As Date

    On Error Resume Next
    If IsBlank(raw) Then Exit Function
    If Not IsDate(raw) Then Exit Function
    Err.Clear
    d = CDate(raw)
    If Err.Number <> 0 Then
        Err.Clear
        Exit Function
    End If

    If TimeValue(d) <> 0 Then
        outDate = d
        ExcelCellToProjectDate = True
        Exit Function
    End If

    If isFinish Then
        defT = ProjectDefaultEndTime()
    Else
        defT = ProjectDefaultStartTime()
    End If

    outDate = DateValue(d) + TimeValue(defT)
    ExcelCellToProjectDate = True
End Function

# Driver's Daily Log Sheet Format

> Source: blank-paper-log.png + Schneider tutorial video (YouTube)

## Overview
Each log sheet covers exactly 24 hours (midnight to midnight).
The grid has 4 horizontal rows, each representing a duty status.

## The Grid
- X-axis: 24 hours, midnight to midnight
- Each hour is divided into 15-minute increments (tick marks)
- Y-axis: 4 rows

### Row Labels
1. Off Duty
2. Sleeper Berth
3. Driving
4. On Duty (not driving)

## How Lines Are Drawn
- Horizontal line on the appropriate row for the duration of that status
- Vertical line connecting rows when status changes (the "step")
- Example: driving from 6am-8am = horizontal line on row 3 from hour 6 to hour 8

## How to Mark Status Changes
- Place a dot at the time of change
- Draw horizontal line from previous dot to new dot on the current row
- Drop a vertical line to the new row, then continue horizontal

## Header Fields
- Date (month/day/year)
- From / To (origin and destination)
- Name of Carrier
- Main Office Address / Home Terminal Address
- Total Miles Driving Today
- Total Mileage Today
- Truck/Tractor and Trailer Numbers / License Plates

## Remarks Section
- Below the grid
- Every status change requires a remark entry
- Format: location (city, state) + activity
- Example: "Green Bay, WI — Pre-trip inspection"
- Example: "Fond du Lac, WI — Scale"
- Example: "Chicago, IL — Pickup"

## Daily Totals (bottom right)
- Hours on each of the 4 lines
- Must sum to exactly 24 hours
- Total driving hours
- Total on-duty hours

## Recap Section
- 70-hour/8-day recap
- Column A: On duty hours today
- Column B: Total hours on duty last 7 days including today
- Column C: Hours available tomorrow (70 minus B)

## Shipping Documents Section
- DVL or Manifest No.
- Shipper & Commodity

## Multiple Sheets
- One sheet per calendar day
- For multi-day trips, generate one sheet per day
- Each sheet starts at midnight and ends at midnight

## Rendering Strategy (for our app)
- Use SVG or HTML Canvas
- Grid dimensions: map 24 hours to pixel width
- Each hour = fixed pixel width, 15-min ticks
- 4 rows with equal height
- Draw lines based on schedule segments
- Remarks as text below grid

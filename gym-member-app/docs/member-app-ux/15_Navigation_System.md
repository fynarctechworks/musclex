# MUSCLEX PRODUCT BIBLE

# Volume 04 — Product Architecture

## Document 15

# Navigation System

---

Document ID: MUSCLEX-NAV-001

Version: 1.0

Status: Approved

Priority: CRITICAL

Owner: Product Architecture Team

---

# Purpose

This document defines every navigation principle, interaction pattern, routing rule, accessibility guideline, and user movement throughout the MuscleX ecosystem.

Navigation should feel invisible.

Users should always know:

• Where they are

• What they can do

• Where to go next

• How to return

---

# Navigation Principles

Every navigation decision must follow these principles.

1. Fast

The shortest path wins.

---

2. Predictable

The same interaction should always behave the same way.

---

3. Discoverable

Users should naturally discover features without tutorials.

---

4. Forgiving

Mistakes should be easy to recover from.

---

5. Accessible

Every feature should be reachable without complex gestures.

---

6. Adaptive

Navigation adapts based on the user's goals and behavior.

---

# Navigation Hierarchy

Level 0

Operating System

↓

Level 1

Authentication

↓

Level 2

Onboarding

↓

Level 3

Main Application

↓

Level 4

Core Modules

↓

Level 5

Feature Screens

↓

Level 6

Detail Screens

↓

Level 7

Dialogs & Bottom Sheets

---

# Primary Navigation

The application uses five persistent bottom navigation items.

Home

Workout

AI Coach

Community

Profile

These tabs should remain stable.

Users build muscle memory around them.

Never change their order.

---

# Floating Action Button (FAB)

A global FAB appears on key screens.

Purpose:

Enable the most common actions instantly.

Default Actions

Start Workout

Log Meal

Log Water

Scan Barcode

Ask AI

Log Weight

Check In

Book Class

Create Challenge

The FAB opens an adaptive quick-action sheet.

Actions are personalized.

---

# Home Navigation

The Home screen is dynamic.

Cards provide shortcuts to:

Today's Workout

Nutrition

Recovery

Hydration

Sleep

AI Insights

Classes

Membership

Progress

Challenges

Community

Upcoming Events

Every card is tappable.

---

# AI Navigation

The AI Coach is available globally.

Users can:

Open AI from navigation

Long press FAB

Voice shortcut (Future)

Home widget

Notification

Search

The AI can also navigate users.

Example:

"Show my progress"

↓

AI opens Progress module.

---

# Search Navigation

Global Search must be accessible from every screen.

Search indexes:

Exercises

Meals

Gyms

Classes

Friends

Challenges

Articles

Recipes

Programs

Settings

Support

Every search result opens directly to its destination.

---

# Gesture Navigation

Supported gestures:

Swipe back

Pull to refresh

Swipe between dashboard cards

Long press quick actions

Pinch images

Drag reorder widgets

Never require hidden gestures for critical functionality.

---

# Notification Routing

Every notification opens the exact destination.

Examples

Workout Reminder

↓

Workout Details

Meal Reminder

↓

Food Diary

Membership Renewal

↓

Membership Screen

Challenge Invitation

↓

Challenge Details

Friend Request

↓

Profile

No notification should ever land on the Home screen unless absolutely necessary.

---

# Deep Linking

Every screen supports deep linking.

Examples

musclex://workout/session/1024

musclex://challenge/summer-2027

musclex://trainer/chat

musclex://recipe/healthy-breakfast

musclex://gym/class/12

Deep links must work whether the app is:

Open

Backgrounded

Closed

Installed after clicking

---

# Back Navigation Rules

Back should always return users to the previous logical screen.

Never:

Lose entered data

Restart flows

Close unexpectedly

Trigger duplicate API calls

Forms must preserve drafts where appropriate.

---

# Authentication Routing

Logged Out

↓

Authentication

↓

Onboarding (if first login)

↓

Dashboard

Returning User

↓

Dashboard

Incomplete Profile

↓

Profile Completion

Expired Membership

↓

Membership Prompt (non-blocking)

---

# Adaptive Navigation

Navigation changes based on context.

Example

Beginner

Home emphasizes:

Today's Workout

Water

Goals

Education

Advanced User

Home emphasizes:

Performance

PRs

Recovery

Analytics

Gym Member

Home includes:

Class Schedule

Attendance

Trainer Messages

Membership

Home Workout User

Home emphasizes:

Programs

Equipment

AI Coach

Nutrition

The navigation framework stays consistent while content adapts.

---

# Tablet Navigation

Tablets use a Navigation Rail.

Desktop uses a collapsible Sidebar.

Mobile uses Bottom Navigation.

Navigation concepts remain identical.

---

# Wearable Navigation

Wearables expose only essential actions:

Start Workout

Pause Workout

Heart Rate

Water

Steps

Rest Timer

Workout Progress

AI Voice Tip

No complex settings.

---

# Empty States

Every empty screen must answer:

Why is this empty?

What should I do next?

How do I get started?

Example

"No workouts yet."

Button

Create My First Workout

---

# Offline Navigation

Offline modules remain accessible:

Workout History

Current Workout

Templates

Saved Meals

Progress

Downloaded Programs

Pending actions synchronize automatically.

---

# Universal Navigation Rules

Maximum three taps to reach any frequently used feature.

Critical actions always available.

Never hide primary functionality inside settings.

Avoid nested menus deeper than three levels.

---

# Accessibility Navigation

Support:

Screen Readers

Large Fonts

Keyboard Navigation

Switch Access

Voice Navigation (Future)

High Contrast Mode

Reduced Motion

Large Touch Targets

---

# Microinteractions

Navigation should feel alive.

Examples

Smooth transitions

Shared element animations

Card expansion

Bottom sheet gestures

Haptic feedback

Progress animations

Loading skeletons

These should communicate state, not distract users.

---

# Error Recovery

If navigation fails:

Show a friendly error.

Allow retry.

Preserve context.

Never trap users in dead ends.

---

# Success Metrics

Average taps to complete key tasks

Navigation error rate

Search success rate

Feature discoverability

Task completion time

Back-navigation errors

Screen abandonment rate

---

# Product Rules

Never add a new navigation tab without executive product approval.

Every new feature must be discoverable through:

Home

Search

AI

Deep Link

Quick Action

Notifications

No feature should exist in isolation.

---

# Navigation Philosophy

Navigation is not about moving between screens.

Navigation is about helping users achieve their goals with the least possible effort.

Every tap should create confidence.

Every transition should reduce friction.

Every screen should make the next action obvious.

---

# End of Document

Document ID: MUSCLEX-NAV-001

Next Document:

16_Feature_Catalog.md
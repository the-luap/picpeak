# Product Requirements Document: Event Photo Sharing Platform

## 1. Executive Summary

### 1.1 Product Overview
A secure, customizable photo sharing platform designed primarily for wedding photo booths but adaptable for any event type. The platform enables event organizers to easily share photos with guests through password-protected, time-limited links while maintaining a simple file-based backend system with automatic archiving.

### 1.2 Key Value Propositions
- **Simple Backend Management**: Drop photos in folders, generate links instantly
- **Secure Sharing**: Password-protected access with expiration dates
- **Automated Lifecycle**: Automatic archiving and storage optimization
- **Proactive Communication**: Email notifications for key events
- **Personalized Experience**: Custom branding for each event
- **Analytics Integration**: Track engagement through Umami
- **Versatile Use Cases**: Optimized for weddings but suitable for any event

## 2. Product Goals & Objectives

### 2.1 Primary Goals
- Provide a seamless, time-limited photo sharing experience for event guests
- Minimize technical complexity for administrators
- Ensure photo privacy through password protection and link expiration
- Automate storage management through intelligent archiving
- Enable detailed analytics on photo access and engagement
- Keep stakeholders informed through automated notifications

### 2.2 Success Metrics
- Time to generate new event gallery (<2 minutes)
- Guest satisfaction score (>90%)
- Photo view/download rates
- System uptime (99.9%)
- Successful automatic archiving rate (100%)
- Email delivery rate (>98%)

## 3. User Personas

### 3.1 Administrator (Event Organizer/Photographer)
- **Background**: Professional photographer or event organizer
- **Technical Skills**: Basic to intermediate
- **Needs**: Quick photo upload, easy link generation, access analytics, automated cleanup
- **Pain Points**: Complex upload processes, managing multiple events, storage management

### 3.2 End User (Event Guest)
- **Background**: Wedding guest or event attendee
- **Technical Skills**: Varies widely
- **Needs**: Easy photo viewing, downloading, sharing within timeframe
- **Pain Points**: Complicated interfaces, slow loading, expired links

### 3.3 Event Host (Bride/Groom/Celebrant)
- **Background**: Person celebrating the event
- **Technical Skills**: Basic
- **Needs**: Notification of gallery availability, awareness of expiration
- **Pain Points**: Missing the opportunity to save photos, not knowing when gallery is ready

## 4. Functional Requirements

### 4.1 Backend Administration

#### 4.1.1 File Management System
- **Photo Upload**: Direct file system access via designated folders
- **Folder Structure**:
  ```
  /events/
    ├── active/
    │   ├── wedding-smith-jones-2024-06-15/
    │   │   ├── collages/
    │   │   │   ├── collage_001.jpg
    │   │   │   └── collage_002.jpg
    │   │   └── individual/
    │   │       ├── photo_001.jpg
    │   │       └── photo_002.jpg
    │   └── birthday-emma-2024-07-20/
    │       └── photos/
    └── archived/
        └── wedding-smith-jones-2024-06-15.zip
  ```
- **Supported Formats**: JPEG, PNG, WebP
- **Auto-detection**: System monitors folders for new photos
- **Automatic Archiving**: Upon expiration, compress folder to ZIP and move to archive

#### 4.1.2 Link Generation
- **Unique URL Generation**: Automatic creation of shareable links
- **Password Setting**: Admin sets password during link creation
- **Expiration Date**: Mandatory expiration date selection (default: 30 days)
- **Event Metadata**:
  - Event type (wedding, birthday, corporate, etc.)
  - Names (couple names for weddings, celebrant for others)
  - Event date
  - Host email address (for notifications)
  - Admin notification email
  - Custom welcome message
  - Color theme selection
  - Link validity period

#### 4.1.3 Email Notification System
- **Trigger Events**:
  - Link creation: Notify host with access details
  - Link expiration warning: 7 days before expiration
  - Link expiration: Notify both host and admin
  - Archive completion: Confirm to admin
- **Email Templates**: Customizable, branded email templates
- **Configuration**: SMTP settings, from address, reply-to address

#### 4.1.4 Admin Dashboard
- **Event Management**: List all events, active/inactive/archived status
- **Expiration Overview**: Timeline view of upcoming expirations
- **Analytics Overview**: Quick stats per event
- **Link Management**: Copy links, reset passwords, extend expiration, deactivate events
- **Bulk Operations**: Archive old events, batch photo operations
- **Email Configuration**: Template management, SMTP settings
- **Archive Management**: View and download archived ZIPs

### 4.2 Frontend Guest Experience

#### 4.2.1 Landing Page
- **Password Entry**: Clean, intuitive password input
- **Event Preview**: Show event name, date, and expiration notice
- **Expiration Warning**: Prominent display if <7 days remaining
- **Expired State**: Clear message with contact information if expired
- **Responsive Design**: Mobile-first approach

#### 4.2.2 Gallery View
- **Expiration Banner**: Sticky banner showing days remaining
- **Grid Layout**: Responsive photo grid with lazy loading
- **View Toggle**: Switch between collages and individual photos
- **Sorting Options**: By date, name, or custom order
- **Search**: Basic filename or date search
- **Download Urgency**: Prominent "Download All" for soon-to-expire galleries

#### 4.2.3 Photo Interactions
- **Lightbox View**: Full-screen photo viewing with navigation
- **Zoom**: Pinch-to-zoom on mobile, mouse wheel on desktop
- **Download Options**:
  - Single photo download
  - Bulk download (selected photos)
  - Download all (ZIP file)
- **Sharing**: Direct link to specific photos (respects expiration)

#### 4.2.4 Personalization
- **Dynamic Theming**: Based on event type and admin preferences
- **Custom Headers**: Event names, dates, and messages
- **Branded Elements**: Optional logo upload
- **Expiration Messaging**: Customizable expiration notices

### 4.3 Analytics Integration

#### 4.3.1 Umami Analytics
- **Page Views**: Track gallery visits
- **User Actions**: Photo views, downloads, time spent
- **Device/Browser Stats**: Understand user base
- **Geographic Data**: Guest locations
- **Custom Events**:
  - Password entries (successful/failed)
  - Photo downloads
  - Share button clicks
  - Expiration warning views
  - Last-minute download spikes

### 4.4 Archiving System

#### 4.4.1 Automatic Archiving Process
- **Trigger**: Activated upon link expiration
- **Process**:
  1. Create ZIP file with folder structure preserved
  2. Verify ZIP integrity
  3. Move ZIP to archive location
  4. Delete original files
  5. Update database with archive location
  6. Send confirmation emails

#### 4.4.2 Archive Management
- **Storage Optimization**: Compression settings for long-term storage
- **Retrieval System**: Admin can restore archives if needed
- **Retention Policy**: Configurable long-term retention rules

## 5. Technical Requirements

### 5.1 Architecture

#### 5.1.1 Infrastructure
- **Backend Access**: Dedicated FQDN (e.g., admin.photos.domain.com)
- **Frontend Access**: Public FQDN (e.g., photos.domain.com)
- **File Storage**: Local file system or network-attached storage
- **Archive Storage**: Separate location for long-term ZIP storage
- **Database**: Lightweight database for metadata (SQLite or PostgreSQL)
- **Email Service**: SMTP integration or email service provider

#### 5.1.2 Security
- **HTTPS**: Required for both frontend and backend
- **Password Hashing**: Bcrypt or similar for stored passwords
- **Rate Limiting**: Prevent brute force attacks
- **Access Logs**: Track all access attempts
- **Expiration Enforcement**: Server-side validation of link validity

### 5.2 Performance Requirements
- **Page Load Time**: <3 seconds on 4G connection
- **Image Optimization**: Automatic thumbnail generation
- **Caching**: CDN integration for static assets
- **Concurrent Users**: Support 100+ simultaneous users per event
- **Archive Generation**: Complete within 10 minutes for 1000 photos

### 5.3 Technology Stack (Recommended)
- **Backend**: Node.js with Express or Python with FastAPI
- **Frontend**: React or Vue.js for dynamic interactions
- **Image Processing**: Sharp (Node.js) or Pillow (Python)
- **File Monitoring**: Chokidar or Watchdog
- **Analytics**: Umami self-hosted or cloud
- **Email Service**: Nodemailer or SendGrid
- **Job Queue**: Bull (Node.js) or Celery (Python) for archiving tasks
- **Scheduler**: Node-cron or APScheduler for expiration checks

## 6. User Interface Requirements

### 6.1 Design Principles
- **Modern Aesthetic**: Clean, minimalist design
- **Wedding-Optimized**: Elegant typography, romantic color options
- **Urgency Communication**: Clear expiration indicators
- **Accessibility**: WCAG 2.1 AA compliant
- **Responsive**: Mobile, tablet, and desktop optimized

### 6.2 UI Components
- **Photo Grid**: Masonry or uniform grid layout
- **Navigation**: Sticky header with view toggles
- **Expiration Timer**: Countdown display for urgent galleries
- **Loading States**: Skeleton screens for better UX
- **Error Handling**: Friendly error messages
- **Email Status**: Indicators for sent notifications

### 6.3 Branding Options
- **Color Schemes**: Pre-defined themes plus custom colors
- **Font Selection**: Google Fonts integration
- **Layout Templates**: Multiple gallery layout options
- **Email Templates**: Matching email designs

## 7. Non-Functional Requirements

### 7.1 Scalability
- Horizontal scaling capability
- Support for 10,000+ photos per event
- Efficient handling of high-resolution images
- Queue system for archiving operations

### 7.2 Reliability
- 99.9% uptime SLA
- Automated backups (including archives)
- Graceful error handling
- Failed job retry mechanisms

### 7.3 Maintainability
- Clear code documentation
- Modular architecture
- Automated testing suite
- Monitoring for failed archiving jobs

### 7.4 Compliance
- GDPR compliance for EU users
- Copyright considerations
- Privacy policy and terms of service
- Data retention policies

## 8. Email Templates

### 8.1 Link Creation Email (to Host)
- Subject: "Your [Event Name] Photos Are Ready!"
- Content: Access details, password, expiration date
- Call-to-action: View gallery button

### 8.2 Expiration Warning Email
- Subject: "Your [Event Name] Photos Expire in 7 Days"
- Content: Urgency message, download instructions
- Call-to-action: Download all photos button

### 8.3 Expiration Notification Email
- To Host: "Your [Event Name] Photo Gallery Has Expired"
- To Admin: "[Event Name] Gallery Archived Successfully"
- Content: Confirmation of archiving, contact for retrieval

## 9. Future Enhancements

### 9.1 Phase 2 Features
- **Flexible Expiration**: Extend expiration for individual users
- **Partial Downloads**: Resume interrupted downloads
- **AI-Powered Features**: Face recognition for automatic grouping
- **Social Integration**: Direct sharing to social media
- **Guest Uploads**: Allow guests to add their photos
- **Video Support**: Basic video playback

### 9.2 Phase 3 Features
- **Mobile Apps**: Native iOS/Android applications
- **Print Integration**: Direct ordering of prints
- **Event Packages**: Bundled services with photographers
- **Multi-language Support**: Internationalization
- **Cloud Archive**: Optional cloud storage for archives

## 10. Success Criteria

### 10.1 Launch Criteria
- Successfully handle 10 concurrent events
- Process 1,000 photos in <5 minutes
- 100% successful archiving rate
- Achieve 95% positive user feedback in beta
- Email delivery rate >98%

### 10.2 Post-Launch Metrics
- Monthly active events: 100+
- Average photos per event: 200+
- Guest engagement rate: 70%+
- Download rate: 50%+ of guests
- On-time archiving: 99%+

## 11. Risks & Mitigation

### 11.1 Technical Risks
- **Storage Limitations**: Implement automated archiving and cloud storage
- **Performance Issues**: Progressive loading and CDN usage
- **Security Breaches**: Regular security audits
- **Archive Failures**: Redundant archiving with verification
- **Email Delivery**: Multiple SMTP providers, delivery monitoring

### 11.2 Business Risks
- **Low Adoption**: Marketing partnerships with photographers
- **Feature Creep**: Strict MVP scope adherence
- **Support Burden**: Comprehensive documentation and FAQs
- **Expired Link Complaints**: Clear communication, grace period

## 12. Timeline & Milestones

### 12.1 Development Phases
- **Phase 1 (MVP)**: 10-12 weeks
  - Core functionality
  - Basic UI
  - Expiration system
  - Email notifications
  - Archiving system
  - Umami integration
- **Phase 2 (Enhancement)**: 4-6 weeks
  - Advanced features
  - Performance optimization
- **Phase 3 (Polish)**: 2-4 weeks
  - UI refinements
  - Beta testing

### 12.2 Key Milestones
- Week 2: Technical architecture finalized
- Week 4: Backend functionality complete
- Week 6: Frontend gallery functional
- Week 7: Email system integrated
- Week 8: Archiving system complete
- Week 9: Analytics integrated
- Week 12: Beta launch

## 13. Appendices

### 13.1 Technical Specifications
- Detailed API documentation
- Database schema (including expiration tracking)
- File naming conventions
- Archive format specifications

### 13.2 Design Mockups
- UI wireframes
- Email template designs
- Expiration state displays
- Style guide
- Component library

### 13.3 Testing Plan
- Unit test coverage
- Integration testing
- Archiving system testing
- Email delivery testing
- User acceptance criteria
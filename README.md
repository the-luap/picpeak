# 📸 PicPeak - Open Source Photo Sharing for Events

<div align="center">
  <img src="docs/picpeak-logo.png" alt="PicPeak Logo" width="300" />
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
  [![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
</div>

**PicPeak** is a powerful, self-hosted open-source alternative to commercial photo-sharing platforms like PicDrop.com and Scrapbook.de. Designed specifically for photographers and event organizers, PicPeak makes it simple to share beautiful, time-limited photo galleries with clients while maintaining full control over your data and branding.

![PicPeak Gallery Preview](docs/screenshot-gallery.png)

## 🌟 Why Choose PicPeak?

Unlike expensive SaaS solutions, PicPeak gives you:

- **💰 No Monthly Fees** - One-time setup, unlimited galleries
- **🔒 Complete Data Control** - Your photos stay on your server
- **🎨 White-Label Ready** - Full branding customization
- **📱 Mobile-First Design** - Beautiful on all devices
- **🚀 Lightning Fast** - Optimized performance and caching
- **🌍 Multi-Language** - Built-in i18n support (EN, DE)

## ✨ Key Features

### For Photographers
- 📁 **Drag & Drop Upload** - Simply drop photos into folders
- ⏰ **Auto-Expiring Galleries** - Set expiration dates (default: 30 days)
- 🔐 **Password Protection** - Secure client galleries
- 📧 **Automated Emails** - Creation confirmations and expiration warnings
- 📊 **Analytics Dashboard** - Track views, downloads, and engagement
- 🎨 **Custom Themes** - Match your brand perfectly

### For Clients
- 🖼️ **Beautiful Galleries** - Clean, modern interface
- 📱 **Mobile Optimized** - Swipe through photos on any device
- ⬇️ **Bulk Downloads** - Download all photos with one click
- 🔍 **Smart Search** - Find photos quickly
- 📤 **Guest Uploads** - Optional client photo uploads

### Technical Excellence
- 🐳 **Docker Ready** - Deploy in minutes
- 🔄 **Auto-Processing** - Automatic thumbnail generation
- 💾 **Smart Storage** - Automatic archiving of expired galleries
- 🛡️ **Security First** - JWT auth, rate limiting, CORS protection
- 📈 **Scalable** - From small studios to large agencies

## 🚀 Quick Start

Get PicPeak running in under 5 minutes:

```bash
# Clone the repository
git clone https://github.com/the-luap/picpeak.git
cd picpeak

# Copy environment template
cp .env.example .env

# Edit configuration (required: JWT_SECRET)
nano .env

# Start with Docker Compose
docker-compose up -d

# Access at http://localhost:3005
```

## 📖 Documentation

- 📘 [**Deployment Guide**](DEPLOYMENT_GUIDE.md) - Detailed installation instructions
- 🤝 [**Contributing**](CONTRIBUTING.md) - How to contribute
- 📜 [**License**](LICENSE) - MIT License
- 🔒 [**Security**](SECURITY.md) - Security policies
- 📋 [**Code of Conduct**](CODE_OF_CONDUCT.md) - Community guidelines

## 🎯 Use Cases

Perfect for:
- 💒 **Wedding Photographers** - Share ceremony photos securely
- 🎂 **Event Photography** - Birthday parties, corporate events
- 📸 **Portrait Studios** - Client galleries with download limits
- 🏢 **Corporate Events** - Internal photo sharing with branding
- 🎓 **School Photography** - Secure parent access with expiration

## 🏗️ Tech Stack

- **Backend**: Node.js, Express, SQLite/PostgreSQL
- **Frontend**: React, Tailwind CSS, Framer Motion
- **Storage**: File-based with automatic archiving
- **Email**: SMTP with customizable templates
- **Analytics**: Privacy-focused with Umami integration

## 💻 System Requirements

### Minimum Requirements
- **CPU**: 2 CPU cores
- **RAM**: 2GB minimum
- **Storage**: 20GB minimum (plus photo storage needs)
- **OS**: Linux (Ubuntu 20.04+), macOS, or Windows with WSL2
- **Node.js**: v18.0.0 or higher
- **Database**: SQLite (included) or PostgreSQL 12+

### Docker Requirements (Recommended)
- **Docker**: v20.10.0+
- **Docker Compose**: v2.0.0+

## 🤝 Contributing

We love contributions! PicPeak is built by photographers, for photographers. Whether you're fixing bugs, adding features, or improving documentation, your help is welcome.

See our [Contributing Guide](CONTRIBUTING.md) for details.

## 📊 Comparison with Alternatives

| Feature | PicPeak | PicDrop | Scrapbook.de |
|---------|---------|---------|--------------|
| Self-Hosted | ✅ | ❌ | ❌ |
| Custom Branding | ✅ Full | Limited | Limited |
| Monthly Cost | $0 | $29-199 | €19-99 |
| Storage Limit | Unlimited* | 50-500GB | 100-1000GB |
| Client Uploads | ✅ | ✅ | ✅ |
| API Access | ✅ | Paid | ❌ |
| Open Source | ✅ | ❌ | ❌ |

*Limited only by your server storage

## 🛡️ Security

PicPeak takes security seriously:
- 🔐 Password hashing with bcrypt
- 🎫 JWT-based authentication
- 🚦 Rate limiting on all endpoints
- 🛡️ CORS protection
- 📝 Activity logging
- 🔒 Secure file access

Found a security issue? Please open a [security issue](https://github.com/the-luap/picpeak/issues/new?labels=security) on GitHub

## 📸 Screenshots

### 🎛️ **Admin Dashboard**
Get a complete overview of your photo galleries, analytics, and system status.

<img src="docs/screenshot-dashboard.png" alt="PicPeak Admin Dashboard" width="800" />

### 📊 **Analytics & Insights**
Track gallery performance, view statistics, and monitor user engagement.

<img src="docs/screenshot-analytics.png" alt="PicPeak Analytics Dashboard" width="800" />

### 📁 **Event Management**
Organize and manage your photo galleries with intuitive event management tools.

<img src="docs/screenshots-events.png" alt="PicPeak Events Management" width="800" />

### ✨ **Key Interface Highlights**

<details>
<summary>👆 Click to see more interface details</summary>

#### What makes PicPeak's interface special:

- **🎨 Clean Design**: Modern, photographer-friendly interface
- **📱 Responsive**: Perfect on desktop, tablet, and mobile
- **⚡ Fast Loading**: Optimized for quick photo browsing
- **🔒 Secure Access**: Password-protected galleries with expiration
- **📤 Easy Uploads**: Drag & drop functionality for effortless photo management
- **🎯 Client-Focused**: Intuitive gallery experience for your clients

</details>

## 🗺️ Roadmap

We're constantly improving PicPeak and welcome contributions from our community! If you have ideas for new features or want to help implement existing ones, please open an issue or submit a pull request. Your contributions help make PicPeak better for everyone.

| Feature | Description | Priority | Status |
|---------|-------------|----------|---------|
| **Backup & Restore** | Comprehensive backup system with S3/MinIO support, automated scheduling, and safe restore functionality | High | ✅ Implemented |
| **Gallery Templates** | Additional gallery layouts and themes (masonry, slideshow, story-style) for different event types | Medium | 🔄 Open |
| **Face Recognition** | AI-powered face detection to help guests find their photos and create automatic person-based albums | Low | 🔄 Open |
| **Gallery Feedback** | Allow guests to like, rate, and comment on photos with admin notifications and moderation | Medium | ✅ Implemented (not tested) |
| **Video Support** | Upload and display videos alongside photos in galleries with streaming support | Low | 🔄 Open |
| **Multiple Administrators** | Support for multiple admin accounts with role-based permissions and activity tracking | Low | 📋 Planned |

**Status Legend:** ✅ Implemented | 🚧 In Progress | 🔄 Open | 📋 Planned

## 🙏 Acknowledgments

PicPeak is inspired by the best features of commercial platforms while remaining completely open source. Special thanks to all contributors who make this project possible.

### 🤖 AI-Assisted Development

This project was generated with the assistance of AI technology, but has been:
- ✅ **Fully tested end-to-end** by human developers
- 🔒 **Security audited** with comprehensive security checks
- 👨‍💻 **Human-reviewed** for code quality and best practices
- 🧪 **Production-tested** in real-world scenarios

We believe in transparent development practices and the responsible use of AI as a tool to accelerate development while maintaining high standards of quality and security.

## 📄 License

PicPeak is released under the [MIT License](LICENSE). Use it freely for personal or commercial projects.

## 🚀 Ready to Get Started?

1. ⭐ **Star this repository** to show your support
2. 📖 Read the [Deployment Guide](DEPLOYMENT_GUIDE.md)
3. 🐛 Report issues or request features
4. 🤝 Join our community and contribute!

---

<p align="center">
  Made with ❤️ by photographers, for photographers
  <br>
  <a href="https://github.com/the-luap/picpeak">GitHub</a> •
  <a href="DEPLOYMENT_GUIDE.md">Documentation</a> •
  <a href="https://github.com/the-luap/picpeak/issues">Support</a>
</p>
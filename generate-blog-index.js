const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

class BlogIndexGenerator {
    constructor(blogDirectory = './Blogs') {
        this.blogDirectory = blogDirectory;
        this.indexFile = path.join(blogDirectory, 'blog-index.json');
    }

    async generateIndex() {
        try {
            console.log('🔍 Scanning for blog files...');
            
            // Ensure Blogs directory exists
            if (!fs.existsSync(this.blogDirectory)) {
                fs.mkdirSync(this.blogDirectory, { recursive: true });
                console.log('📁 Created Blogs directory');
            }

            // Find all HTML files in the Blogs directory (exclude blogs.html)
            const files = fs.readdirSync(this.blogDirectory)
                .filter(file => file.endsWith('.html') && file !== 'blogs.html')
                .sort();

            console.log(`📄 Found ${files.length} blog files`);

            // Extract metadata from each file
            const blogMetadata = [];
            for (const filename of files) {
                try {
                    const metadata = await this.extractMetadata(filename);
                    blogMetadata.push({
                        filename,
                        ...metadata,
                        lastModified: fs.statSync(path.join(this.blogDirectory, filename)).mtime.toISOString()
                    });
                    console.log(`✅ Processed: ${filename}`);
                } catch (error) {
                    console.warn(`⚠️  Error processing ${filename}:`, error.message);
                }
            }

            // Create the index
            const index = {
                generated: new Date().toISOString(),
                count: blogMetadata.length,
                files: files,
                blogs: blogMetadata
            };

            // Write the index file
            fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2));
            console.log(`✨ Generated blog index with ${blogMetadata.length} entries`);
            console.log(`📍 Index saved to: ${this.indexFile}`);

            return index;

        } catch (error) {
            console.error('❌ Error generating blog index:', error);
            throw error;
        }
    }

    async extractMetadata(filename) {
        const filePath = path.join(this.blogDirectory, filename);
        const html = fs.readFileSync(filePath, 'utf8');
        
        // Parse HTML using JSDOM
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        // Extract title
        const title = this.getMetaContent(doc, 'title') ||
                     doc.querySelector('title')?.textContent?.trim() ||
                     doc.querySelector('h1')?.textContent?.trim() ||
                     this.formatTitle(filename);

        // Extract description
        const description = this.getMetaContent(doc, 'description') ||
                           this.getMetaContent(doc, 'og:description') ||
                           this.extractFirstParagraph(doc) ||
                           'An interactive exploration of data science concepts.';

        // Extract keywords/tags
        const keywords = this.getMetaContent(doc, 'keywords') ||
                        this.getMetaContent(doc, 'tags') ||
                        '';

        // Extract date
        const date = this.getMetaContent(doc, 'date') ||
                    this.getMetaContent(doc, 'article:published_time') ||
                    fs.statSync(filePath).mtime.toISOString().split('T')[0];

        // Process tags
        let tags = [];
        if (keywords) {
            tags = keywords.split(',').map(tag => tag.trim().toLowerCase());
        } else {
            tags = this.inferTags(filename, title, description);
        }

        return {
            title,
            description: description.length > 150 ? description.substring(0, 147) + '...' : description,
            date: date.split('T')[0], // Ensure YYYY-MM-DD format
            tags,
            wordCount: this.countWords(doc)
        };
    }

    getMetaContent(doc, name) {
        // Try name attribute
        const metaName = doc.querySelector(`meta[name="${name}"]`);
        if (metaName && metaName.content) {
            return metaName.content.trim();
        }
        
        // Try property attribute (for Open Graph)
        const metaProperty = doc.querySelector(`meta[property="${name}"]`);
        if (metaProperty && metaProperty.content) {
            return metaProperty.content.trim();
        }
        
        return null;
    }

    extractFirstParagraph(doc) {
        // Try to find the first meaningful paragraph
        const paragraphs = doc.querySelectorAll('p');
        for (let p of paragraphs) {
            const text = p.textContent.trim();
            if (text.length > 50 && !text.includes('<!')) {
                return text;
            }
        }

        // If no good paragraph, try other elements
        const headers = doc.querySelectorAll('h2, h3, h4');
        if (headers.length > 0) {
            return headers[0].textContent.trim();
        }

        return null;
    }

    inferTags(filename, title, description) {
        const text = (filename + ' ' + title + ' ' + description).toLowerCase();
        const tagMap = {
            'machine-learning': ['machine', 'learning', 'ml', 'algorithm', 'model', 'prediction', 'neural', 'deep'],
            'statistics': ['statistics', 'statistical', 'probability', 'distribution', 'regression', 'hypothesis'],
            'visualization': ['visualization', 'chart', 'graph', 'plot', 'visual', 'dashboard'],
            'interactive': ['interactive', 'simulation', 'demo', 'explorer', 'widget'],
            'bias-variance': ['bias', 'variance', 'tradeoff', 'dartboard', 'overfitting'],
            'data-science': ['data', 'science', 'analysis', 'analytics', 'insights'],
            'python': ['python', 'pandas', 'numpy', 'matplotlib', 'seaborn'],
            'r-programming': ['r programming', 'ggplot', 'dplyr', 'tidyverse'],
            'biostatistics': ['biostatistics', 'medical', 'clinical', 'epidemiology', 'health']
        };

        const inferredTags = [];
        for (const [tag, keywords] of Object.entries(tagMap)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                inferredTags.push(tag);
            }
        }

        return inferredTags.length > 0 ? inferredTags : ['visualization', 'interactive'];
    }

    formatTitle(filename) {
        return filename
            .replace('.html', '')
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    countWords(doc) {
        const textContent = doc.body?.textContent || '';
        return textContent.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
}

// CLI usage
if (require.main === module) {
    const generator = new BlogIndexGenerator();
    
    generator.generateIndex()
        .then(() => {
            console.log('🎉 Blog index generation complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Failed to generate blog index:', error);
            process.exit(1);
        });
}

module.exports = BlogIndexGenerator;
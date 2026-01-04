class ContactForm extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.state = {
      name: '',
      email: '',
      message: '',
      submitting: false,
      success: false,
      error: null
    };
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  static get observedAttributes() {
    return ['api-url'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'api-url' && oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const apiUrl = this.getAttribute('api-url') || '/api/contacts';
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        }
        
        .form-container {
          background: white;
          padding: 40px;
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          height: 100%;
        }
        
        h2 {
          color: #333;
          margin-bottom: 1.5rem;
          text-align: center;
          font-size: 1.8rem;
        }
        
        .form-group {
          margin-bottom: 1.5rem;
        }
        
        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #555;
        }
        
        input, textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 5px;
          font-size: 1rem;
          transition: all 0.3s ease;
          box-sizing: border-box;
          font-family: inherit;
        }
        
        input:focus, textarea:focus {
          outline: none;
          border-color: #4a6cf7;
          box-shadow: 0 0 0 3px rgba(74, 108, 247, 0.1);
        }
        
        input:invalid, textarea:invalid {
          border-color: #dc3545;
        }
        
        input:valid, textarea:valid {
          border-color: #28a745;
        }
        
        textarea {
          min-height: 120px;
          resize: vertical;
        }
        
        .submit-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 0.75rem 2rem;
          border-radius: 5px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .submit-btn:disabled {
          background: #cccccc;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }
        
        .message {
          padding: 0.75rem;
          border-radius: 5px;
          margin-bottom: 1rem;
          text-align: center;
          animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        
        .error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        
        .loading {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255,255,255,.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
          margin-right: 8px;
          vertical-align: middle;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .required::after {
          content: " *";
          color: #dc3545;
        }
        
        .error-message {
          color: #dc3545;
          font-size: 0.875rem;
          margin-top: 0.25rem;
          min-height: 1.2rem;
        }
        
        .char-count {
          text-align: right;
          font-size: 0.875rem;
          color: #666;
          margin-top: 0.25rem;
        }
        
        .api-info {
          font-size: 0.8rem;
          color: #666;
          text-align: center;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #eee;
        }
      </style>
      
      <div class="form-container">
        <div id="message" class="message" style="display: none;"></div>
        
        <form id="contactForm" novalidate>
          <div class="form-group">
            <label for="name" class="required">Name</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              required 
              minlength="2"
              maxlength="100"
              placeholder="Enter your name"
              autocomplete="name"
            >
            <div class="error-message" id="name-error"></div>
          </div>
          
          <div class="form-group">
            <label for="email" class="required">Email</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required
              placeholder="Enter your email"
              autocomplete="email"
            >
            <div class="error-message" id="email-error"></div>
          </div>
          
          <div class="form-group">
            <label for="message" class="required">Message</label>
            <textarea 
              id="message-input" 
              name="message" 
              required 
              minlength="10"
              maxlength="1000"
              placeholder="Enter your message (10-1000 characters)"
            ></textarea>
            <div class="char-count">
              <span id="char-count">0</span>/1000 characters
            </div>
            <div class="error-message" id="message-input-error"></div>
          </div>
          
          <button type="submit" class="submit-btn" id="submitBtn">
            Send Message
          </button>
        </form>
      </div>
    `;
  }

  setupEventListeners() {
    const form = this.shadowRoot.getElementById('contactForm');
    const submitBtn = this.shadowRoot.getElementById('submitBtn');
    const nameInput = this.shadowRoot.getElementById('name');
    const emailInput = this.shadowRoot.getElementById('email');
    const messageInput = this.shadowRoot.getElementById('message-input');
    const charCount = this.shadowRoot.getElementById('char-count');

    // Character counter for message
    messageInput.addEventListener('input', (e) => {
      charCount.textContent = e.target.value.length;
      this.validateField(e.target);
    });

    // Real-time validation
    [nameInput, emailInput].forEach(input => {
      input.addEventListener('input', (e) => {
        this.validateField(e.target);
      });
      input.addEventListener('blur', (e) => {
        this.validateField(e.target);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  }

  validateField(field) {
    const errorId = `${field.id}-error`;
    const errorElement = this.shadowRoot.getElementById(errorId);
    
    field.setCustomValidity('');
    
    if (!field.value.trim()) {
      field.setCustomValidity('This field is required');
      this.showError(field, errorElement, 'This field is required');
      return false;
    }

    if (field.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(field.value)) {
        field.setCustomValidity('Please enter a valid email address');
        this.showError(field, errorElement, 'Please enter a valid email address');
        return false;
      }
    }

    if (field.id === 'name' && field.value.length < 2) {
      field.setCustomValidity('Name must be at least 2 characters');
      this.showError(field, errorElement, 'Name must be at least 2 characters');
      return false;
    }

    if (field.id === 'message-input' && field.value.length < 10) {
      field.setCustomValidity('Message must be at least 10 characters');
      this.showError(field, errorElement, 'Message must be at least 10 characters');
      return false;
    }

    // Clear error
    this.clearError(field, errorElement);
    return true;
  }

  showError(field, errorElement, message) {
    field.style.borderColor = '#dc3545';
    errorElement.textContent = message;
  }

  clearError(field, errorElement) {
    field.style.borderColor = '';
    errorElement.textContent = '';
  }

  validateForm() {
    const nameInput = this.shadowRoot.getElementById('name');
    const emailInput = this.shadowRoot.getElementById('email');
    const messageInput = this.shadowRoot.getElementById('message-input');
    
    const isNameValid = this.validateField(nameInput);
    const isEmailValid = this.validateField(emailInput);
    const isMessageValid = this.validateField(messageInput);
    
    return isNameValid && isEmailValid && isMessageValid;
  }

  async handleSubmit() {
    if (!this.validateForm() || this.state.submitting) {
      return;
    }

    this.setState({ submitting: true });
    this.showMessage('', ''); // Clear previous messages

    const formData = {
      name: this.shadowRoot.getElementById('name').value,
      email: this.shadowRoot.getElementById('email').value,
      message: this.shadowRoot.getElementById('message-input').value
    };

    try {
      const apiUrl = this.getAttribute('api-url') || '/api/contacts';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        this.showMessage('Thank you! Your message has been sent successfully.', 'success');
        this.shadowRoot.getElementById('contactForm').reset();
        this.shadowRoot.getElementById('char-count').textContent = '0';
        this.setState({ success: true });
        
        // Dispatch custom event on success
        this.dispatchEvent(new CustomEvent('contact-submitted', {
          detail: formData,
          bubbles: true,
          composed: true
        }));
        
        // Reset success state after 5 seconds
        setTimeout(() => {
          this.setState({ success: false });
        }, 5000);
      } else {
        throw new Error(data.error || data.details?.[0]?.msg || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      this.showMessage(error.message || 'Something went wrong. Please try again later.', 'error');
    } finally {
      this.setState({ submitting: false });
    }
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.updateButton();
  }

  updateButton() {
    const submitBtn = this.shadowRoot.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = this.state.submitting;
      submitBtn.innerHTML = this.state.submitting 
        ? '<span class="loading"></span> Sending...'
        : 'Send Message';
    }
  }

  showMessage(text, type) {
    const messageEl = this.shadowRoot.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.style.display = text ? 'block' : 'none';
    
    // Auto-hide error messages after 10 seconds
    if (type === 'error') {
      setTimeout(() => {
        if (messageEl.textContent === text) {
          this.showMessage('', '');
        }
      }, 10000);
    }
  }
}

// Register the web component
if (!customElements.get('contact-form')) {
  customElements.define('contact-form', ContactForm);
}